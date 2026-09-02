import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testMistralFood() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('MISTRAL_API_KEY missing from .env.local');
    process.exit(1);
  }

  const imagePath = path.resolve(__dirname, '../test_sets/test_food.png');
  const fileBuffer = fs.readFileSync(imagePath);
  const base64Image = fileBuffer.toString('base64');
  const mimeType = 'image/png';

  const prompt = `
You are a dietary component identification tool. Analyze this image of a meal or drink.
Identify the core dietary components present that are commonly relevant for drug-food interactions. 
Examples of components: grapefruit, dairy, alcohol, caffeine, leafy greens (high vitamin K), etc.

Return ONLY a JSON array of the detected components, with a confidence score between 0.0 and 1.0.

CRITICAL RULES:
1. Do NOT state whether a component is safe or unsafe.
2. Do NOT mention any medications or drug interactions.
3. Your output must be purely observational (what is in the image).
4. Return ONLY the JSON array. No markdown wrappers.

Output JSON Schema:
[
  {
    "component_name": "string (lowercase)",
    "confidence_score": 0.0
  }
]
`;

  console.log('Sending food image to mistral-medium-3-5...');
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-medium-3-5',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: `data:${mimeType};base64,${base64Image}` }
          ]
        }
      ]
    })
  });

  const status = res.status;
  if (!res.ok) {
    const err = await res.text();
    console.error(`Food Extraction Failed: HTTP ${status} - ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const resultText = data.choices?.[0]?.message?.content || '';
  
  console.log(`Food Extraction Success: HTTP ${status}`);
  console.log('--- PARSED JSON OUTPUT ---');
  console.log(resultText);
  console.log('--------------------------');
}

testMistralFood().catch(err => {
  console.error("Test failed:", err);
});
