import { createClient } from '@supabase/supabase-js';

const url = 'http://127.0.0.1:54321';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAccount(email: string, role: string, metadata: any) {
  console.log(`Creating user: ${email}...`);
  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { role, ...metadata }
  });
  
  if (error) {
    console.error(`Failed to create ${email}:`, error.message);
    return null;
  }
  
  console.log(`Created ${email} successfully [ID: ${user.user.id}]`);
  return user.user;
}

async function main() {
  console.log('Seeding E2E Deterministic Accounts...');
  
  await createAccount('patient_a@test.com', 'patient', { first_name: 'Patient', last_name: 'A' });
  await createAccount('patient_b@test.com', 'patient', { first_name: 'Patient', last_name: 'B' });
  
  await createAccount('professional_a@test.com', 'professional', { first_name: 'Dr.', last_name: 'A', title: 'Cardiologist', organization: 'MediMind E2E Clinic' });
  await createAccount('professional_b@test.com', 'professional', { first_name: 'Dr.', last_name: 'B', title: 'General Practitioner', organization: 'MediMind E2E Clinic' });
  
  console.log('Seed completed successfully.');
}

main().catch(console.error);
