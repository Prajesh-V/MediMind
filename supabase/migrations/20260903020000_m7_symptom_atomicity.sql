-- M7 Hardening: Atomic Symptom Creation and M8 Trace Generation

CREATE OR REPLACE FUNCTION create_patient_symptom_report_atomic(
  p_symptom_id uuid,
  p_symptom text,
  p_severity text,
  p_onset_at timestamptz,
  p_related_medication_id uuid,
  p_notes text,
  p_trace_id uuid,
  p_event_timestamp text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_existing_report patient_symptom_reports;
  v_new_report patient_symptom_reports;
  
  v_previous_event_hash text;
  v_canonical_metadata text;
  v_canonical_payload text;
  v_hash_input text;
  v_event_hash text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Idempotency Check: Prevent duplicate exact submissions within 1 minute
  SELECT * INTO v_existing_report
  FROM patient_symptom_reports
  WHERE patient_id = v_caller_id
    AND symptom = p_symptom
    AND severity = p_severity
    AND onset_at = p_onset_at
    AND created_at >= (now() - interval '1 minute')
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'data', row_to_json(v_existing_report), 'was_created', false)::jsonb;
  END IF;

  -- 2. Medication Ownership Check
  IF p_related_medication_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM patient_medications 
      WHERE id = p_related_medication_id 
        AND patient_id = v_caller_id
    ) THEN
      RAISE EXCEPTION 'Invalid related medication ID';
    END IF;
  END IF;

  -- 3. Insert Symptom Report
  INSERT INTO patient_symptom_reports (
    id, patient_id, symptom, severity, onset_at, related_medication_id, notes
  ) VALUES (
    p_symptom_id, v_caller_id, p_symptom, p_severity, p_onset_at, p_related_medication_id, p_notes
  ) RETURNING * INTO v_new_report;

  -- 4. Authoritative M8 Trace Hash-Chain Generation
  -- 4a. Lock the latest trace event to prevent race conditions in sequence
  SELECT event_hash INTO v_previous_event_hash
  FROM clinical_trace_events
  WHERE patient_id = v_caller_id
  ORDER BY created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF v_previous_event_hash IS NULL THEN
    v_previous_event_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;

  -- 4b. Construct Canonical Metadata manually
  v_canonical_metadata := '{"severity":' || p_severity || ',"symptom":' || p_symptom || ',"symptom_report_id":' || p_symptom_id::text || '}';

  -- 4c. Construct Canonical Payload
  v_canonical_payload := v_caller_id::text || '||PATIENT_OBSERVATION_REPORTED|' || p_event_timestamp || '|patient|' || v_caller_id::text || '|SymptomReportForm|1.0.0|' || v_canonical_metadata;

  -- 4d. Compute hash using pgcrypto digest
  v_hash_input := v_previous_event_hash || '|' || v_canonical_payload;
  v_event_hash := encode(extensions.digest(v_hash_input, 'sha256'::text), 'hex');

  -- 4e. Insert into Immutable Trace Ledger
  INSERT INTO clinical_trace_events (
    id, patient_id, assessment_id, event_type, event_timestamp, 
    actor_type, actor_id, source_component, source_version, 
    metadata, previous_event_hash, event_hash
  ) VALUES (
    p_trace_id, 
    v_caller_id, 
    NULL, 
    'PATIENT_OBSERVATION_REPORTED', 
    p_event_timestamp::timestamptz,
    'patient', 
    v_caller_id, 
    'SymptomReportForm', 
    '1.0.0', 
    json_build_object('severity', p_severity, 'symptom', p_symptom, 'symptom_report_id', p_symptom_id)::jsonb, 
    v_previous_event_hash, 
    v_event_hash
  );

  RETURN json_build_object('success', true, 'data', row_to_json(v_new_report), 'was_created', true)::jsonb;
END;
$$;
