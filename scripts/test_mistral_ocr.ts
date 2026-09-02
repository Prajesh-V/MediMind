import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testMistralOCR() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('MISTRAL_API_KEY missing from .env.local');
    process.exit(1);
  }

  const imagePath = path.resolve(__dirname, '../test_sets/test_prescription.png');
  const fileBuffer = fs.readFileSync(imagePath);
  const base64Image = fileBuffer.toString('base64');
  const mimeType = 'image/png'; // assumption based on extension

  console.log('Sending to Mistral OCR API (mistral-ocr-latest)...');
  const ocrRes = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:${mimeType};base64,${base64Image}`
      }
    })
  });

  const ocrStatus = ocrRes.status;
  if (!ocrRes.ok) {
    const err = await ocrRes.text();
    console.error(`OCR API Failed: HTTP ${ocrStatus} - ${err}`);
    process.exit(1);
  }

  const ocrData = await ocrRes.json();
  const markdownContent = ocrData.pages?.[0]?.markdown || '';
  console.log(`OCR Success: HTTP ${ocrStatus}`);
  console.log('--- OCR OUTPUT SNIPPET ---');
  console.log(markdownContent.substring(0, 100) + '...');
  console.log('--------------------------');

  console.log('Sending OCR text to mistral-medium-3-5 for structured extraction...');
  
  const prompt = `
You are a strict data extraction tool. Analyze this prescription text OCR.
Extract the medications found. For each medication, provide:
- medication_name
- dosage (strength and unit)
- form (e.g. tablet, capsule, injection)
- frequency (e.g. twice daily, every 8 hours)

For each field, return a JSON object with:
- "value": string or null if entirely missing.
- "confidence": one of "high", "low", "missing", or "conflicting".
- "raw_text": the exact text snippet from the document.

CRITICAL RULES:
1. Do NOT hallucinate missing fields. If a field is not on the prescription, set its value to null and confidence to "missing".
2. Do NOT provide medical advice, interaction warnings, or treatment recommendations.
3. Return ONLY a JSON array of these extracted medications. No markdown wrappers.

Output JSON Schema:
[
  {
    "medication_name": { "value": "string", "confidence": "high|low|missing|conflicting", "raw_text": "string" },
    "dosage": { "value": "string", "confidence": "high|low|missing|conflicting", "raw_text": "string" },
    "form": { "value": "string", "confidence": "high|low|missing|conflicting", "raw_text": "string" },
    "frequency": { "value": "string", "confidence": "high|low|missing|conflicting", "raw_text": "string" }
  }
]
`;

  const extractRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-medium-3-5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: markdownContent }
      ]
    })
  });

  const extractStatus = extractRes.status;
  if (!extractRes.ok) {
    const err = await extractRes.text();
    console.error(`Extraction API Failed: HTTP ${extractStatus} - ${err}`);
    process.exit(1);
  }

  const extractData = await extractRes.json();
  const resultText = extractData.choices?.[0]?.message?.content || '';
  
  console.log(`Extraction Success: HTTP ${extractStatus}`);
  console.log('--- PARSED JSON OUTPUT ---');
  console.log(resultText);
  console.log('--------------------------');
}

testMistralOCR().catch(err => {
  console.error("Test failed:", err);
});
