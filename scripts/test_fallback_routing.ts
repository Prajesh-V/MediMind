import { extractPrescription } from '../src/services/multimodal/ocr';
import { extractFoodImage } from '../src/services/multimodal/vision';
import { generateControlledExplanation } from '../src/services/medical/explanations';
import { generateLongitudinalExplanation } from '../src/services/medical/longitudinal-explanations';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('=== AI ROUTING FALLBACK VERIFICATION ===');
  
  // 1. OCR
  console.log('\n--- Testing OCR Routing ---');
  try {
    const fakeImageBuffer = Buffer.from('fake-image-data');
    await extractPrescription(fakeImageBuffer, 'image/jpeg');
  } catch (e) {
    console.log('OCR Caught Error (Expected if Gemini also fails due to invalid image/keys):', e);
  }

  // 2. Vision
  console.log('\n--- Testing Vision Routing ---');
  try {
    const fakeImageBuffer = Buffer.from('fake-image-data');
    await extractFoodImage(fakeImageBuffer, 'image/jpeg');
  } catch (e) {
    console.log('Vision Caught Error:', e);
  }

  // 3. M7 Explanation
  console.log('\n--- Testing M7 Explanation Routing ---');
  try {
    const fakeAssessment = {
      interaction_type: 'Drug-Drug',
      severity: 'High',
      affected_medication_names: ['Drug A', 'Drug B'],
      affected_food_components: [],
      mechanism: 'Test mechanism',
      effect: 'Test effect',
      rule_key: 'R1',
      evidence_references: []
    };
    await generateControlledExplanation(fakeAssessment as any, 'patient');
  } catch (e) {
    console.log('M7 Caught Error:', e);
  }

  // 4. M10 Explanation
  console.log('\n--- Testing M10 Explanation Routing ---');
  try {
    const fakePattern = {
      pattern_type: 'Toxicity',
      observation_window_days: 30,
      observation_count: 3,
      threshold_value: 2,
      first_event_at: new Date().toISOString(),
      last_event_at: new Date().toISOString(),
      deterministic_summary: 'Test summary'
    };
    await generateLongitudinalExplanation(fakePattern as any, 'professional');
  } catch (e) {
    console.log('M10 Caught Error:', e);
  }
}

run().catch(console.error);
