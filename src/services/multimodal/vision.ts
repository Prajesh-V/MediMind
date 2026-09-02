import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedFoodComponent {
  component_name: string;
  confidence_score: number; // 0.0 to 1.0
}

export interface VisionExtractionResult {
  run_id: string;
  status: 'success' | 'failed';
  components: ExtractedFoodComponent[];
}

/**
 * Uses Gemini Vision API for probabilistic food identification.
 */
async function _extractFoodImageViaGemini(fileBuffer: Buffer, mimeType: string): Promise<VisionExtractionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL_VISION || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

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

  const imageParts = [{ inlineData: { data: fileBuffer.toString('base64'), mimeType } }];
  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;
  const text = response.text().trim();
  const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  return {
    run_id: crypto.randomUUID(),
    status: 'success',
    components: JSON.parse(cleanText) as ExtractedFoodComponent[]
  };
}

async function _extractFoodImageViaMistral(fileBuffer: Buffer, mimeType: string): Promise<VisionExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY missing');
  }

  const base64Image = fileBuffer.toString('base64');
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

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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

  if (!res.ok) {
    throw new Error(`Mistral Food Extraction Failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const resultText = data.choices?.[0]?.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  return {
    run_id: crypto.randomUUID(),
    status: 'success',
    components: JSON.parse(cleanText) as ExtractedFoodComponent[]
  };
}

async function _extractFoodImageViaOllama(fileBuffer: Buffer, mimeType: string): Promise<VisionExtractionResult> {
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
  const base64Image = fileBuffer.toString('base64');
  
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

  let res;
  try {
    res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        format: 'json',
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image]
          }
        ],
        stream: false
      })
    });
  } catch (e) {
    throw new Error('Ollama service unreachable. Is it running?');
  }

  if (!res.ok) {
    throw new Error(`Ollama Food Extraction Failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const resultText = data.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleanText);
  } catch (e) {
    return { run_id: crypto.randomUUID(), status: 'failed', components: [] };
  }
  
  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      const firstKey = Object.keys(parsed)[0];
      if (Array.isArray(parsed[firstKey])) {
        parsed = parsed[firstKey];
      } else {
        return { run_id: crypto.randomUUID(), status: 'failed', components: [] };
      }
    } else {
      return { run_id: crypto.randomUUID(), status: 'failed', components: [] };
    }
  }

  return {
    run_id: crypto.randomUUID(),
    status: 'success',
    components: parsed as ExtractedFoodComponent[]
  };
}

export async function extractFoodImage(fileBuffer: Buffer, mimeType: string): Promise<VisionExtractionResult> {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'ollama') {
    console.log('[AI_ROUTING] Attempting primary provider: Ollama');
    try {
      return await _extractFoodImageViaOllama(fileBuffer, mimeType);
    } catch (error) {
      console.error(`[AI_ROUTING] Ollama failure category: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('[AI_ROUTING] Falling back to secondary provider: Gemini');
      
      try {
        return await _extractFoodImageViaGemini(fileBuffer, mimeType);
      } catch (geminiError) {
        console.error('[AI_ROUTING] Gemini fallback failed:', geminiError);
        return {
          run_id: crypto.randomUUID(),
          status: 'failed',
          components: []
        };
      }
    }
  }

  console.log('[AI_ROUTING] Attempting primary provider: Gemini');
  try {
    return await _extractFoodImageViaGemini(fileBuffer, mimeType);
  } catch (error) {
    console.error('[AI_ROUTING] Gemini failure:', error);
    return {
      run_id: crypto.randomUUID(),
      status: 'failed',
      components: []
    };
  }
}
