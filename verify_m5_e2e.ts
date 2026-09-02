import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { extractPrescription } from './src/services/multimodal/ocr';
import { extractFoodImage } from './src/services/multimodal/vision';

// 1. Verify Env
console.log('--- PHASE 1: ENVIRONMENT VERIFICATION ---');
const requiredKeys = ['GEMINI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
let envPass = true;
for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.error(`❌ Missing ${key}`);
    envPass = false;
  } else {
    console.log(`✅ ${key} is present`);
  }
}
if (!envPass) process.exit(1);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''; // anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('\n--- PHASE 2: GEMINI CONNECTIVITY TEST ---');
    console.log('Connectivity will be tested in Phase 3 & 4 via actual extraction functions.');

    console.log('\n--- PHASE 3: REAL PRESCRIPTION OCR TEST ---');
    const rxPath = path.join(__dirname, 'test_sets', 'test_prescription.png');
    if (!fs.existsSync(rxPath)) throw new Error('test_prescription.png not found');
    const rxBuffer = fs.readFileSync(rxPath);

    console.log('Calling extractPrescription...');
    const rxResult = await extractPrescription(rxBuffer, 'image/png');
    console.log('OCR Result Status:', rxResult.status);
    console.log('OCR Candidates:', JSON.stringify(rxResult.candidates, null, 2));

    if (rxResult.status !== 'success') {
      console.error('OCR failed:', rxResult.warnings);
      process.exit(1);
    }
    console.log('✅ Prescription Candidate extracted successfully.');

    console.log('\n--- PHASE 4: REAL FOOD VISION TEST ---');
    const foodPath = path.join(__dirname, 'test_sets', 'test_food.png');
    if (!fs.existsSync(foodPath)) throw new Error('test_food.png not found');
    const foodBuffer = fs.readFileSync(foodPath);

    console.log('Calling extractFoodImage...');
    const foodResult = await extractFoodImage(foodBuffer, 'image/png');
    console.log('Vision Result Status:', foodResult.status);
    console.log('Vision Components:', JSON.stringify(foodResult.components, null, 2));

    if (foodResult.status !== 'success') {
      console.error('Vision failed');
      process.exit(1);
    }
    console.log('✅ Food Candidate extracted successfully.');

    console.log('\n✅ M5 GEMINI PIPELINE VERIFICATION COMPLETE!');
    process.exit(0);

  } catch (e) {
    console.error('Unexpected Error:', e);
    process.exit(1);
  }
}

run();
