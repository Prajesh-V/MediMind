import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Seeding realistic test data...');

  // 1. Get Identities
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;

  const patientA = users.users.find(u => u.email === 'patient_a@test.local');
  const profA = users.users.find(u => u.email === 'professional_a@test.local');

  if (!patientA || !profA) {
    throw new Error('Test identities not found. Please run e2e setup or user seed script first.');
  }

  const patientId = patientA.id;
  const profId = profA.id;
  
  console.log(`Found Patient A: ${patientId}`);
  console.log(`Found Professional A: ${profId}`);

  // 2. Ensure Active Connection
  const { error: connErr } = await supabase.from('patient_professional_connections').upsert({
    patient_id: patientId,
    professional_id: profId,
    status: 'active',
    updated_at: new Date().toISOString()
  }, { onConflict: 'patient_id, professional_id' });
  if (connErr) throw connErr;
  console.log('Active connection ensured.');

  // 3. Clear existing medications/data for cleanliness
  await supabase.from('patient_medications').delete().eq('patient_id', patientId);
  await supabase.from('dietary_records').delete().eq('patient_id', patientId);
  await supabase.from('prescription_candidates').delete().eq('patient_id', patientId);

  // 4. Seed Medications (M3)
  // Atorvastatin, Lisinopril, Spironolactone
  const meds = [
    {
      patient_id: patientId,
      is_active: true,
      display_name: 'Atorvastatin 40mg',
      rxcui: '617320',
      food_relation: 'no_relation',
      start_date: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
      patient_id: patientId,
      is_active: true,
      display_name: 'Lisinopril 20mg',
      rxcui: '314076',
      food_relation: 'no_relation',
      start_date: new Date(Date.now() - 60 * 86400000).toISOString()
    },
    {
      patient_id: patientId,
      is_active: true,
      display_name: 'Spironolactone 25mg',
      rxcui: '314231',
      food_relation: 'with_meal',
      start_date: new Date(Date.now() - 60 * 86400000).toISOString()
    }
  ];

  const { data: insertedMeds, error: medErr } = await supabase
    .from('patient_medications')
    .insert(meds)
    .select();
  if (medErr) throw medErr;
  
  console.log('Medications inserted.');

  // 5. Seed Schedules and Dose Events
  for (const med of insertedMeds) {
    const { data: schedule, error: schedErr } = await supabase.from('medication_schedules').insert({
      patient_medication_id: med.id,
      patient_id: patientId,
      time_of_day: '08:00:00'
    }).select().single();
    if (schedErr) throw schedErr;

    // Generate last 7 days of doses
    const now = new Date();
    const dosesToInsert = [];
    for (let i = 1; i <= 7; i++) {
      const scheduledTime = new Date(now);
      scheduledTime.setDate(now.getDate() - i);
      scheduledTime.setHours(8, 0, 0, 0);

      let status = 'taken';
      let consumedAt = new Date(scheduledTime.getTime() + 15 * 60000); // 15 mins later

      if (med.display_name.includes('Lisinopril')) {
        // Trigger M10 missed/skipped patterns
        if (i <= 3) {
          status = 'missed'; // Last 3 days missed
          consumedAt = null as any;
        } else if (i <= 5) {
          status = 'skipped'; // 4,5 days ago skipped
          consumedAt = null as any;
        }
      }

      dosesToInsert.push({
        patient_id: patientId,
        patient_medication_id: med.id,
        status,
        taken_at: consumedAt ? consumedAt.toISOString() : scheduledTime.toISOString()
      });
    }

    const { error: doseErr } = await supabase.from('dose_events').insert(dosesToInsert);
    if (doseErr) throw doseErr;
  }
  console.log('Doses inserted (Including M10 patterns).');

  // 6. Seed Dietary Data (M6 interaction triggering)
  // Grapefruit -> interacts with Atorvastatin
  await supabase.from('patient_dietary_intake').delete().eq('patient_id', patientId);
  
  const { error: dietErr } = await supabase.from('patient_dietary_intake').insert({
    patient_id: patientId,
    component_name: 'grapefruit',
    consumed_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  });
  if (dietErr) throw dietErr;
  console.log('Dietary data inserted.');

  // 7. Seed Prescription Candidates (M5)
  // Needs a parent prescription row first per schema references!
  const { data: prescription, error: pErr } = await supabase.from('prescriptions').insert({
    patient_id: patientId,
    file_path: 'mock_prescription.pdf'
  }).select().single();
  if (pErr) throw pErr;

  const { error: rxErr } = await supabase.from('prescription_candidates').insert({
    prescription_id: prescription.id,
    status: 'pending',
    raw_name: 'Amlodipine 5mg',
    raw_dosage: '5mg',
    raw_frequency: 'daily',
    suggested_rxcui: '197361',
    suggested_name: 'Amlodipine 5mg'
  });
  if (rxErr) throw rxErr;
  console.log('Prescription candidate inserted.');

  console.log('Data seeded successfully!');
}

run().catch(console.error);
