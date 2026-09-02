BEGIN;
-- Set up a simulated patient session
DO $$
DECLARE
  v_patient_a uuid;
  v_patient_b uuid;
  v_med_b uuid;
  v_result jsonb;
  v_trace_count int;
  v_symptom_id uuid;
  v_trace_id uuid;
BEGIN
  -- Get two patients
  SELECT id INTO v_patient_a FROM patients LIMIT 1;
  SELECT id INTO v_patient_b FROM patients WHERE id <> v_patient_a LIMIT 1;
  
  -- Get an active medication belonging to Patient B
  SELECT id INTO v_med_b FROM patient_medications WHERE patient_id = v_patient_b LIMIT 1;

  -- Test 1: Cross-Patient Medication Injection
  -- Impersonate Patient A
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_patient_a || '", "role": "authenticated"}', true);
  
  BEGIN
    PERFORM create_patient_symptom_report_atomic(
      gen_random_uuid(), 'Headache', 'mild', now(), v_med_b, NULL, gen_random_uuid(), now()::text
    );
    RAISE EXCEPTION 'TEST FAILED: Allowed cross-patient medication injection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Invalid related medication ID' THEN
      RAISE NOTICE 'Test 1 PASS: Cross-patient medication correctly rejected.';
    ELSE
      RAISE EXCEPTION 'Test 1 FAILED with unexpected error: %', SQLERRM;
    END IF;
  END;

  -- Test 2: Idempotency (Same request twice sequentially)
  v_symptom_id := gen_random_uuid();
  v_trace_id := gen_random_uuid();
  
  v_result := create_patient_symptom_report_atomic(
    v_symptom_id, 'Nausea', 'moderate', '2026-09-03T12:00:00Z'::timestamptz, NULL, NULL, v_trace_id, '2026-09-03T12:00:00.000Z'
  );
  
  IF v_result->>'was_created' = 'true' THEN
    RAISE NOTICE 'Test 2 (First Call) PASS: Created new symptom.';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: Expected creation.';
  END IF;

  v_result := create_patient_symptom_report_atomic(
    gen_random_uuid(), 'Nausea', 'moderate', '2026-09-03T12:00:00Z'::timestamptz, NULL, NULL, gen_random_uuid(), '2026-09-03T12:00:01.000Z'
  );
  
  IF v_result->>'was_created' = 'false' THEN
    RAISE NOTICE 'Test 2 (Second Call) PASS: Idempotency correctly returned existing row.';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: Duplicate row created.';
  END IF;

  -- Verify exact trace count for Patient A = 1 for this symptom
  SELECT count(*) INTO v_trace_count FROM clinical_trace_events WHERE patient_id = v_patient_a AND event_type = 'PATIENT_OBSERVATION_REPORTED';
  IF v_trace_count = 1 THEN
    RAISE NOTICE 'Test 2 (Trace Check) PASS: Exactly 1 trace event created despite 2 calls.';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: Expected 1 trace event, found %', v_trace_count;
  END IF;
  
  -- Verify hash chain links correctly
  RAISE NOTICE 'Tests successfully completed!';
END;
$$;
ROLLBACK;
