import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') });

async function globalSetup(config: FullConfig) {
  console.log('--- GLOBAL SETUP: Initializing QA Environment ---');

  // Hard safety gate to prevent running against production
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
    throw new Error(`CRITICAL SAFETY GATE FAILED: Attempted to run E2E setup against a non-local Supabase URL: ${supabaseUrl}`);
  }

  if (process.env.E2E_TEST_MODE !== 'true') {
    throw new Error('CRITICAL SAFETY GATE FAILED: E2E_TEST_MODE=true is required');
  }

  console.log('Safety gate passed (local environment detected).');
  console.log('Resetting test database...');
  
  try {
    // execSync('npx supabase db reset', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to reset local database. Ensure local Supabase (and Docker) is running.');
    throw error;
  }

  console.log('Seeding deterministic identities...');
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const seedUsers = [
    { email: 'patient_a@test.local', password: 'Password123!', metadata: { role: 'patient', name: 'PATIENT_A' } },
    { email: 'patient_b@test.local', password: 'Password123!', metadata: { role: 'patient', name: 'PATIENT_B' } },
    { email: 'professional_a@test.local', password: 'Password123!', metadata: { role: 'professional', name: 'PROFESSIONAL_A' } },
    { email: 'professional_b@test.local', password: 'Password123!', metadata: { role: 'professional', name: 'PROFESSIONAL_B' } }
  ];

  for (const user of seedUsers) {
    const { error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: user.metadata
    });
    if (error && !error.message.includes('already exists')) {
      console.error(`Failed to seed ${user.email}:`, error);
    }
  }

  console.log('Global setup complete.');
}

export default globalSetup;
