-- M5 Idempotency Fix: Atomic Candidate Confirmation

CREATE OR REPLACE FUNCTION confirm_prescription_candidate_atomic(
  p_candidate_id uuid,
  p_medication_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate prescription_candidates;
  v_medication patient_medications;
  v_prescription prescriptions;
  v_caller_id uuid;
  v_was_created boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Lock the candidate and prescription rows
  SELECT * INTO v_candidate 
  FROM prescription_candidates 
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  SELECT * INTO v_prescription 
  FROM prescriptions 
  WHERE id = v_candidate.prescription_id
  FOR SHARE;

  IF NOT FOUND OR v_prescription.patient_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized to confirm this candidate';
  END IF;

  -- 2. State Validation
  IF v_candidate.status = 'confirmed' THEN
    IF v_candidate.confirmed_medication_id IS NULL THEN
      -- CASE 3: Corrupt state (should be impossible now)
      RAISE EXCEPTION 'Data integrity error: candidate is confirmed but missing medication ID';
    END IF;
    
    -- CASE 2: Already confirmed, safely return existing
    SELECT * INTO v_medication 
    FROM patient_medications 
    WHERE id = v_candidate.confirmed_medication_id;
    
    RETURN json_build_object('medication', row_to_json(v_medication), 'was_created', false)::jsonb;
  END IF;

  IF v_candidate.status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot confirm a rejected candidate';
  END IF;

  -- 3. Mutation: CASE 1 (Pending)
  INSERT INTO patient_medications (
    patient_id, 
    prescription_id, 
    rxcui, 
    display_name, 
    generic_name, 
    dosage_amount, 
    dosage_unit, 
    dosage_form, 
    route, 
    food_relation, 
    administration_instructions, 
    start_date, 
    end_date, 
    is_prn, 
    is_active, 
    verification_status
  ) VALUES (
    v_caller_id,
    v_candidate.prescription_id,
    p_medication_payload->>'rxcui',
    p_medication_payload->>'display_name',
    p_medication_payload->>'generic_name',
    (p_medication_payload->>'dosage_amount')::numeric,
    p_medication_payload->>'dosage_unit',
    p_medication_payload->>'dosage_form',
    COALESCE(p_medication_payload->>'route', 'oral'),
    COALESCE(p_medication_payload->>'food_relation', 'no_relation')::food_relation_type,
    p_medication_payload->>'administration_instructions',
    COALESCE((p_medication_payload->>'start_date')::date, CURRENT_DATE),
    (p_medication_payload->>'end_date')::date,
    COALESCE((p_medication_payload->>'is_prn')::boolean, false),
    true,
    COALESCE(p_medication_payload->>'verification_status', 'unverified')::medication_verification_status
  ) RETURNING * INTO v_medication;

  v_was_created := true;

  -- Update candidate to mark confirmed and link medication
  UPDATE prescription_candidates 
  SET 
    status = 'confirmed', 
    confirmed_medication_id = v_medication.id
  WHERE id = p_candidate_id;

  RETURN json_build_object('medication', row_to_json(v_medication), 'was_created', v_was_created)::jsonb;
END;
$$;
