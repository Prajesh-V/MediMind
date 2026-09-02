import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const serviceSupabase = createClient(supabaseUrl, serviceKey);
const clientSupabase = createClient(supabaseUrl, anonKey);

async function runTests() {
  console.log('--- STARTING FOCUSED INTEGRITY TESTS ---');

  // 1. Create a test patient A
  const emailA = `test-patient-a-${Date.now()}@test.com`;
  const { data: userA, error: errA } = await serviceSupabase.auth.admin.createUser({
    email: emailA,
    password: 'password123',
    email_confirm: true,
    user_metadata: { role: 'patient' }
  });
  if (errA) throw new Error('Failed to create User A: ' + errA.message);

  // 2. Create a test patient B
  const emailB = `test-patient-b-${Date.now()}@test.com`;
  const { data: userB, error: errB } = await serviceSupabase.auth.admin.createUser({
    email: emailB,
    password: 'password123',
    email_confirm: true,
    user_metadata: { role: 'patient' }
  });
  if (errB) throw new Error('Failed to create User B: ' + errB.message);

  // 3. Create a medication for Patient B
  const { data: medB, error: medErr } = await serviceSupabase
    .from('patient_medications')
    .insert({
      patient_id: userB.user.id,
      rxcui: '12345',
      display_name: 'Test Med B',
      generic_name: 'Test Med B Generic',
      dosage_amount: 10,
      dosage_unit: 'mg',
      dosage_form: 'tablet',
      is_active: true,
      verification_status: 'manual_custom'
    })
    .select()
    .single();

  if (medErr) throw new Error('Failed to create Med B: ' + medErr.message);

  // 4. Log in as Patient A
  const { data: sessionA, error: loginErr } = await clientSupabase.auth.signInWithPassword({
    email: emailA,
    password: 'password123'
  });
  if (loginErr) throw new Error('Failed to log in User A: ' + loginErr.message);

  console.log(`Test Context: Patient A (${userA.user.id}), Patient B (${userB.user.id}), Med B (${medB.id})`);

  // --- TEST 1: Cross-Patient Medication Injection ---
  console.log('\n--- Test 1: Cross-Patient Medication Injection ---');
  const { data: res1, error: err1 } = await clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: crypto.randomUUID(),
    p_symptom: 'Headache',
    p_severity: 'mild',
    p_onset_at: new Date().toISOString(),
    p_related_medication_id: medB.id, // INJECTION
    p_notes: 'Should fail',
    p_trace_id: crypto.randomUUID(),
    p_event_timestamp: new Date().toISOString()
  });

  if (err1 && err1.message.includes('Invalid related medication ID')) {
    console.log('PASS: Cross-patient medication correctly rejected.');
  } else {
    throw new Error('FAIL: Cross-patient injection allowed or unexpected error! ' + JSON.stringify(err1));
  }

  // --- TEST 2: Idempotency (Sequential Duplicate) ---
  console.log('\n--- Test 2: Idempotency (Sequential Duplicate) ---');
  const symptomId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const onset = '2026-09-03T12:00:00Z';
  const timestamp = '2026-09-03T12:01:00.000Z';

  // Call 1
  const { data: res2a, error: err2a } = await clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: symptomId,
    p_symptom: 'Nausea',
    p_severity: 'moderate',
    p_onset_at: onset,
    p_related_medication_id: null,
    p_notes: null,
    p_trace_id: traceId,
    p_event_timestamp: timestamp
  });

  if (err2a) throw new Error('FAIL Call 1: ' + err2a.message);
  if (!res2a.was_created) throw new Error('FAIL Call 1: Expected was_created=true');

  // Call 2 (Exactly the same)
  const { data: res2b, error: err2b } = await clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: crypto.randomUUID(),
    p_symptom: 'Nausea',
    p_severity: 'moderate',
    p_onset_at: onset,
    p_related_medication_id: null,
    p_notes: null,
    p_trace_id: crypto.randomUUID(),
    p_event_timestamp: new Date().toISOString()
  });

  if (err2b) throw new Error('FAIL Call 2: ' + err2b.message);
  if (res2b.was_created) throw new Error('FAIL Call 2: Expected was_created=false (idempotency failed)');

  // Verify Trace Count (Atomicity)
  const { count } = await serviceSupabase
    .from('clinical_trace_events')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userA.user.id)
    .eq('event_type', 'PATIENT_OBSERVATION_REPORTED');
  
  if (count !== 1) {
    throw new Error(`FAIL Trace Atomicity: Expected 1 trace event, got ${count}`);
  }
  console.log('PASS: Idempotency preserved and exactly 1 trace event exists.');

  // --- TEST 3: Concurrent Execution (Race Condition) ---
  console.log('\n--- Test 3: Concurrent Execution ---');
  const symptomIdConcurrent = crypto.randomUUID();
  const traceIdConcurrent = crypto.randomUUID();
  const onsetConcurrent = '2026-09-03T13:00:00Z';
  const timestampConcurrent = '2026-09-03T13:01:00.000Z';

  const reqA = clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: symptomIdConcurrent,
    p_symptom: 'Fever',
    p_severity: 'severe',
    p_onset_at: onsetConcurrent,
    p_related_medication_id: null,
    p_notes: null,
    p_trace_id: traceIdConcurrent,
    p_event_timestamp: timestampConcurrent
  });

  const reqB = clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: crypto.randomUUID(),
    p_symptom: 'Fever',
    p_severity: 'severe',
    p_onset_at: onsetConcurrent,
    p_related_medication_id: null,
    p_notes: null,
    p_trace_id: crypto.randomUUID(),
    p_event_timestamp: new Date().toISOString()
  });

  const [resA, resB] = await Promise.all([reqA, reqB]);

  const createdCount = (resA.data?.was_created ? 1 : 0) + (resB.data?.was_created ? 1 : 0);
  if (createdCount !== 1) {
    throw new Error(`FAIL Concurrency: Expected exactly 1 creation, got ${createdCount}`);
  }

  // Verify Trace Count (Atomicity)
  const { count: countConcurrent } = await serviceSupabase
    .from('clinical_trace_events')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userA.user.id)
    .eq('event_type', 'PATIENT_OBSERVATION_REPORTED');
  
  if (countConcurrent !== 2) { // 1 from earlier test, 1 from this concurrent test
    throw new Error(`FAIL Trace Atomicity: Expected 2 total trace events, got ${countConcurrent}`);
  }
  
  console.log('PASS: Concurrency handled flawlessly with EXACTLY one insertion and one trace event.');

  // --- TEST 4: Transaction Rollback ---
  console.log('\n--- Test 4: Transaction Rollback (Failure inside RPC) ---');
  const rollbackSymptomId = crypto.randomUUID();
  const { data: res4, error: err4 } = await clientSupabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: rollbackSymptomId,
    p_symptom: 'Chills',
    p_severity: 'mild',
    p_onset_at: new Date().toISOString(),
    p_related_medication_id: null,
    p_notes: null,
    p_trace_id: crypto.randomUUID(),
    p_event_timestamp: 'INVALID_TIMESTAMP_STRING' // This will cause the Postgres cast to timestamptz to fail during the trace insert!
  });

  if (!err4) {
    throw new Error('FAIL Rollback: Expected query to fail but it succeeded!');
  }

  // Verify neither symptom nor trace exists
  const { data: rollbackSymptomCheck } = await serviceSupabase
    .from('patient_symptom_reports')
    .select('*')
    .eq('id', rollbackSymptomId);
    
  if (rollbackSymptomCheck && rollbackSymptomCheck.length > 0) {
    throw new Error('FAIL Rollback: Symptom row was committed despite trace failure!');
  }
  console.log('PASS: Symptom row rolled back.');

  const { data: rollbackTraceCheck } = await serviceSupabase
    .from('clinical_trace_events')
    .select('*')
    .eq('metadata->>symptom_report_id', rollbackSymptomId);
    
  if (rollbackTraceCheck && rollbackTraceCheck.length > 0) {
    throw new Error('FAIL Rollback: Trace row was committed despite failure?!');
  }
  console.log('PASS: Trace row rolled back / not committed.');

  console.log('\n✅ ALL INTEGRITY TESTS PASSED!');
}

runTests().catch(console.error);
