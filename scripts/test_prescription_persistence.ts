import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // using service role to bypass RLS for direct testing, or anon if preferred.
// Wait, for testing the DB schema constraints directly, let's use service_role to avoid auth setup complexity.
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== TESTING PRESCRIPTION PERSISTENCE ===');

  // 1. Get a valid patient ID
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users.users.length) {
    console.error('Failed to get a patient ID:', userError);
    process.exit(1);
  }
  const patientId = users.users.find(u => u.email === 'patient_a@test.local')?.id || users.users[0].id;
  console.log('Using Patient ID:', patientId);

  // 2. Mock a fake extraction run
  const { data: run, error: runError } = await supabase
    .from('extraction_runs')
    .insert({
      document_id: null,
      service_provider: 'test-ollama',
      status: 'success'
    })
    .select('id')
    .single();

  if (runError) {
    console.error('Failed to insert mock extraction run. (Perhaps document_id is NOT NULL?)');
    console.error(runError);
    // document_id is probably foreign keyed and required?
    // Let's just create a dummy candidate and see if it persists without run.id or by creating a dummy doc.
  }

  // Create a dummy prescription first since prescription_id is NOT NULL
  const { data: prescription, error: prescriptionError } = await supabase
    .from('prescriptions')
    .insert({ patient_id: patientId, notes: 'Test Prescription' })
    .select('id')
    .single();

  if (prescriptionError || !prescription) {
    console.error('Failed to create parent prescription:', prescriptionError);
    process.exit(1);
  }

  // To test the exact insertion payload from extraction.ts:
  const payload = {
    prescription_id: prescription.id,
    extraction_run_id: run?.id || null,
    raw_name: 'Amoxicillin',
    suggested_rxcui: '723',
    suggested_name: 'Amoxicillin',
    raw_dosage: '500mg',
    raw_frequency: '3x a day for five days',
    status: 'pending',
    extraction_confidence: 'high',
    extraction_warnings: []
  };

  console.log('\nAttempting to insert candidate:', payload);
  const { data, error: insertError } = await supabase
    .from('prescription_candidates')
    .insert([payload])
    .select();

  if (insertError) {
    console.error('❌ Insertion failed with error:', insertError);
  } else {
    console.log('✅ Insertion succeeded!', data);
  }
}

run();
