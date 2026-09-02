import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchRxNorm } from '../rxnorm';

export interface ExtractedMedicationField<T> {
  value: T | null;
  confidence: 'high' | 'low' | 'missing' | 'conflicting';
  raw_text?: string;
}

export interface ExtractedPrescription {
  medication_name: ExtractedMedicationField<string>;
  dosage: ExtractedMedicationField<string>;
  form: ExtractedMedicationField<string>;
  frequency: ExtractedMedicationField<string>;
  rxcui_match: string | null; // Normalized value if matched
}

export interface OCRExtractionResult {
  run_id: string; // ephemeral simulated id
  status: 'success' | 'failed';
  candidates: ExtractedPrescription[];
  warnings: string[];
}

/**
 * Uses Gemini Vision API to extract structured fields from a prescription image/PDF.
 */
async function _extractPrescriptionViaGemini(fileBuffer: Buffer, mimeType: string): Promise<OCRExtractionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL_VISION || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
You are a strict data extraction tool. Analyze this prescription document.
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

  try {
    const imageParts = [
      {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text().trim();
    
    // Strip markdown formatting if Gemini included it despite instructions
    const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    const parsed = JSON.parse(cleanText) as Array<Omit<ExtractedPrescription, 'rxcui_match'>>;
    
    const candidates: ExtractedPrescription[] = [];
    
    for (const item of parsed) {
      let rxcui: string | null = null;
      if (item.medication_name.value) {
        try {
          const rxNormMatch = await searchRxNorm(item.medication_name.value);
          if (rxNormMatch.length > 0) {
            rxcui = rxNormMatch[0].rxcui;
          }
        } catch (e) {
          console.error('RxNorm search failed during extraction:', e);
        }
      }
      
      candidates.push({
        ...item,
        rxcui_match: rxcui
      });
    }

    return {
      run_id: crypto.randomUUID(),
      status: 'success',
      candidates,
      warnings: []
    };
  } catch (error) {
    throw new Error('Gemini OCR failed: ' + String(error));
  }
}

async function _extractPrescriptionViaMistral(fileBuffer: Buffer, mimeType: string): Promise<OCRExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY missing');
  }

  // 1. OCR API
  const base64Image = fileBuffer.toString('base64');
  const ocrRes = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: { type: 'image_url', image_url: `data:${mimeType};base64,${base64Image}` }
    })
  });
  
  if (!ocrRes.ok) {
    throw new Error(`Mistral OCR Failed: HTTP ${ocrRes.status}`);
  }
  
  const ocrData = await ocrRes.json();
  const markdownContent = ocrData.pages?.[0]?.markdown || '';

  // 2. Extraction API
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-medium-3-5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: markdownContent }
      ]
    })
  });

  if (!extractRes.ok) {
    throw new Error(`Mistral Extraction Failed: HTTP ${extractRes.status}`);
  }
  
  const extractData = await extractRes.json();
  const resultText = extractData.choices?.[0]?.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleanText) as Array<Omit<ExtractedPrescription, 'rxcui_match'>>;
  
  const candidates: ExtractedPrescription[] = [];
  for (const item of parsed) {
    let rxcui: string | null = null;
    if (item.medication_name.value) {
      try {
        const rxNormMatch = await searchRxNorm(item.medication_name.value);
        if (rxNormMatch.length > 0) {
          rxcui = rxNormMatch[0].rxcui;
        }
      } catch (e) {
        console.error('RxNorm search failed during extraction:', e);
      }
    }
    candidates.push({ ...item, rxcui_match: rxcui });
  }

  return { run_id: crypto.randomUUID(), status: 'success', candidates, warnings: [] };
}

async function _extractPrescriptionViaOllama(fileBuffer: Buffer, mimeType: string): Promise<OCRExtractionResult> {
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
  const base64Image = fileBuffer.toString('base64');
  
  const prompt = `
You are a strict data extraction tool. Analyze this prescription document.
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
    throw new Error(`Ollama Extraction Failed: HTTP ${res.status}`);
  }
  
  const data = await res.json();
  const resultText = data.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleanText);
  } catch (e) {
    console.warn('[OLLAMA_DEBUG] Invalid JSON syntax:', cleanText);
    return { run_id: crypto.randomUUID(), status: 'failed', candidates: [], warnings: ['Ollama returned invalid JSON.'] };
  }
  
  if (!Array.isArray(parsed)) {
    console.warn('[OLLAMA_DEBUG] Not an array. Raw JSON:', JSON.stringify(parsed));
    // Sometimes local LLMs wrap it in an object like { "medications": [...] }
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      if (parsed.medication_name) {
        // It returned a single medication object instead of an array of medications
        parsed = [parsed];
      } else {
        const firstKey = Object.keys(parsed)[0];
        if (Array.isArray(parsed[firstKey])) {
          parsed = parsed[firstKey];
        } else {
          return { run_id: crypto.randomUUID(), status: 'failed', candidates: [], warnings: ['Ollama did not return a JSON array as requested.'] };
        }
      }
    } else {
      return { run_id: crypto.randomUUID(), status: 'failed', candidates: [], warnings: ['Ollama did not return a JSON array as requested.'] };
    }
  }
  
  const candidates: ExtractedPrescription[] = [];
  for (const item of parsed) {
    let rxcui: string | null = null;
    if (item?.medication_name?.value) {
      try {
        const rxNormMatch = await searchRxNorm(item.medication_name.value);
        if (rxNormMatch.length > 0) {
          rxcui = rxNormMatch[0].rxcui;
        }
      } catch (e) {
        console.error('RxNorm search failed during extraction:', e);
      }
    }
    candidates.push({ ...item, rxcui_match: rxcui });
  }

  return { run_id: crypto.randomUUID(), status: 'success', candidates, warnings: [] };
}

export async function extractPrescription(fileBuffer: Buffer, mimeType: string): Promise<OCRExtractionResult> {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'ollama') {
    console.log('[AI_ROUTING] Attempting primary provider: Ollama');
    try {
      return await _extractPrescriptionViaOllama(fileBuffer, mimeType);
    } catch (error) {
      console.error(`[AI_ROUTING] Ollama failure category: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('[AI_ROUTING] Falling back to secondary provider: Gemini');
      
      try {
        return await _extractPrescriptionViaGemini(fileBuffer, mimeType);
      } catch (geminiError) {
        console.error('[AI_ROUTING] Gemini fallback failed:', geminiError);
        return {
          run_id: crypto.randomUUID(),
          status: 'failed',
          candidates: [],
          warnings: ['Failed to extract text from the document. Both primary (Ollama) and fallback (Gemini) providers failed.']
        };
      }
    }
  }

  console.log('[AI_ROUTING] Attempting primary provider: Gemini');
  try {
    return await _extractPrescriptionViaGemini(fileBuffer, mimeType);
  } catch (error) {
    console.error('[AI_ROUTING] Gemini failure:', error);
    return {
      run_id: crypto.randomUUID(),
      status: 'failed',
      candidates: [],
      warnings: ['Failed to extract text from the document using Gemini.']
    };
  }
}
