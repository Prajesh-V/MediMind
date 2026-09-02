import { createClient } from '@supabase/supabase-js';
import { evaluatePatientInteractions } from '../src/services/medical/interaction-engine';
import { generateControlledExplanation } from '../src/services/medical/explanations';
import type { DatabaseInteractionRule } from '../src/services/medical/types';
import crypto from 'crypto';

// Polyfill crypto for node if needed
if (!global.crypto) {
  global.crypto = crypto as any;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('=== RUNNING M7 EXPLANATION ENGINE TESTS ===\n');

  // 1. Setup Test Assessment
  const mockContext = {
    patient_id: 'test-patient-m7',
    medications: [
      {
        id: 'med-1',
        rxcui: '83367', // Atorvastatin
        display_name: 'Atorvastatin',
        generic_name: 'atorvastatin',
        food_relation: 'no_relation' as const,
      }
    ],
    dietary_records: [
      {
        id: 'diet-1',
        component_name: 'grapefruit',
        consumed_at: new Date().toISOString()
      }
    ]
  };

  const { data: rules } = await supabase.rpc('get_approved_interaction_rules');
  const databaseRules = (rules || []) as unknown as DatabaseInteractionRule[];
  
  const assessments = evaluatePatientInteractions(mockContext, databaseRules);
  const targetAssessment = assessments[0];

  if (!targetAssessment || targetAssessment.rule_key !== 'ATORVASTATIN_GRAPEFRUIT') {
    throw new Error('Failed to setup mock assessment. Ensure Atorvastatin/Grapefruit rule is active.');
  }

  console.log(`✅ Loaded target assessment: ${targetAssessment.assessment_id}`);

  // 2. Generate Patient Explanation
  console.log('\n--- Generating Patient Explanation ---');
  const { output: patientOutput } = await generateControlledExplanation(targetAssessment, 'patient');
  
  console.log('Patient Summary:', patientOutput.summary);
  if (!patientOutput.what_the_system_determined.toLowerCase().includes('moderate')) {
    throw new Error('Patient output did not preserve severity!');
  }
  console.log('✅ Patient explanation preserved M6 severity (Moderate).');

  // 3. Generate Professional Explanation
  console.log('\n--- Generating Professional Explanation ---');
  const { output: proOutput } = await generateControlledExplanation(targetAssessment, 'professional');
  
  console.log('Professional Summary:', proOutput.summary);
  if (!proOutput.what_the_system_determined.toLowerCase().includes('moderate')) {
    throw new Error('Professional output did not preserve severity!');
  }
  console.log('✅ Professional explanation preserved M6 severity (Moderate).');

  console.log('\n✅ ALL M7 EXPLANATION ENGINE TESTS PASSED!');
}

run().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
