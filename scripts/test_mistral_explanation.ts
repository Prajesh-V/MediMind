import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testMistralExplanation() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('MISTRAL_API_KEY missing from .env.local');
    process.exit(1);
  }

  // Example deterministic M6 assessment payload
  const assessmentPayload = {
    medications: ['Atorvastatin 40mg'],
    dietary_components: ['Grapefruit juice'],
    interaction_rule: {
      rule_key: 'ATORVASTATIN_GRAPEFRUIT',
      severity: 'moderate',
      mechanism: 'Grapefruit inhibits CYP3A4, which increases Atorvastatin serum concentrations.',
      clinical_implication: 'Increased risk of myopathy or rhabdomyolysis.'
    }
  };

  const prompt = `
You are a clinical translation assistant. 
Explain this deterministic drug-food interaction to a professional audience.

CRITICAL RULES:
1. Do not change the severity.
2. Do not invent new medications, dietary components, or evidence.
3. Do not invent diagnoses or make causal claims about the patient's current health.
4. Do not recommend treatment changes (only suggest monitoring).
5. Output MUST be valid JSON matching the exact schema below.

Input Assessment:
${JSON.stringify(assessmentPayload, null, 2)}

Output JSON Schema:
{
  "summary": "string",
  "why_this_matters": "string",
  "what_was_detected": "string",
  "what_the_system_determined": "string",
  "next_steps": ["string"],
  "limitations": "string",
  "source_references": ["string"]
}
`;

  console.log('Sending M7 explanation request to mistral-medium-3-5...');
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
        { role: 'user', content: prompt }
      ]
    })
  });

  const status = res.status;
  if (!res.ok) {
    const err = await res.text();
    console.error(`Explanation Failed: HTTP ${status} - ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const resultText = data.choices?.[0]?.message?.content || '';
  
  console.log(`Explanation Success: HTTP ${status}`);
  console.log('--- PARSED JSON OUTPUT ---');
  console.log(resultText);
  console.log('--------------------------');
}

testMistralExplanation().catch(err => {
  console.error("Test failed:", err);
});
