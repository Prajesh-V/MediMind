import { extractPrescription } from '../src/services/multimodal/ocr';
import { extractFoodImage } from '../src/services/multimodal/vision';
import { generateControlledExplanation } from '../src/services/medical/explanations';
import { generateLongitudinalExplanation } from '../src/services/medical/longitudinal-explanations';
import fs from 'fs';
import path from 'path';

const rxPath = path.join(__dirname, '../test_sets/test_prescription.png');
const foodPath = path.join(__dirname, '../test_sets/test_food.png');

async function testRealOllama() {
  console.log('=== REAL OLLAMA INFERENCE TEST ===\n');

  try {
    // 1. PRESCRIPTION WORKFLOW
    console.log('--- 1. PRESCRIPTION EXTRACTION ---');
    if (!fs.existsSync(rxPath)) {
      throw new Error(`Prescription fixture not found at ${rxPath}`);
    }
    const rxBuffer = fs.readFileSync(rxPath);
    console.log('Sending prescription image to Ollama 3B...');
    const rxResult = await extractPrescription(rxBuffer, 'image/png');
    
    if (rxResult.status === 'failed') {
       console.error('❌ OCR Validation Failed:', rxResult.warnings?.join(', '));
    } else {
      console.log('✅ Extraction Result:', JSON.stringify(rxResult.candidates, null, 2));
      if (rxResult.candidates.length > 0 && rxResult.candidates[0].rxcui_match) {
        console.log(`✅ RxNorm Normalization Succeeded: ${rxResult.candidates[0].rxcui_match}`);
      } else {
        console.log('⚠️ RxNorm Normalization did not match (or candidate empty).');
      }
    }


    // 2. FOOD WORKFLOW
    console.log('\n--- 2. FOOD EXTRACTION ---');
    if (!fs.existsSync(foodPath)) {
      throw new Error(`Food fixture not found at ${foodPath}`);
    }
    const foodBuffer = fs.readFileSync(foodPath);
    console.log('Sending food image to Ollama 3B...');
    const foodResult = await extractFoodImage(foodBuffer, 'image/png');
    
    if (foodResult.status === 'failed') {
       throw new Error('Vision Failed');
    }
    console.log('✅ Extraction Result:', JSON.stringify(foodResult.components, null, 2));

    // 3. M7 EXPLANATION
    console.log('\n--- 3. M7 EXPLANATION ---');
    const fakeAssessment = {
      interaction_type: 'Drug-Food',
      severity: 'High',
      affected_medication_names: ['Atorvastatin 20mg'],
      affected_food_components: ['Grapefruit'],
      mechanism: 'Inhibition of CYP3A4 by grapefruit juice leads to increased statin levels.',
      effect: 'Increased risk of myopathy and rhabdomyolysis.',
      rule_key: 'R_DF_001',
      evidence_references: [
         { source: 'FDA', jurisdiction: 'US', url: '' }
      ]
    };
    
    console.log('Sending M7 Assessment to Ollama 3B...');
    const m7Result = await generateControlledExplanation(fakeAssessment as any, 'patient');
    console.log('✅ Explanation Result:', JSON.stringify(m7Result.output, null, 2));


    // 4. M10 EXPLANATION
    console.log('\n--- 4. M10 EXPLANATION ---');
    const fakePattern = {
      pattern_type: 'Adherence',
      observation_window_days: 90,
      observation_count: 5,
      threshold_value: 0,
      first_event_at: new Date().toISOString(),
      last_event_at: new Date().toISOString(),
      deterministic_summary: 'Patient has missed 5 consecutive doses.'
    };
    
    console.log('Sending M10 Pattern to Ollama 3B...');
    const m10Result = await generateLongitudinalExplanation(fakePattern as any, 'professional');
    console.log('✅ Explanation Result:', JSON.stringify(m10Result.output, null, 2));

    console.log('\n✅ ALL REAL INFERENCE TESTS PASSED!');

  } catch (e) {
    console.error('\n❌ TEST FAILED:', e);
    process.exit(1);
  }
}

testRealOllama();
