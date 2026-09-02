import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedPrescription } from './ocr';

export async function generatePrescriptionSummary(
  candidates: ExtractedPrescription[],
  provider: 'gemini' | 'ollama' = 'gemini'
): Promise<string> {
  const defaultSummary = `Extracted ${candidates.length} medication(s).`;

  if (candidates.length === 0) {
    return 'No medications found.';
  }

  const prompt = `
You are a strictly controlled medical summarization layer.
Your ONLY job is to explain the contents of an uploaded prescription deterministically extracted by an OCR engine.
The extraction results are provided below.

AUTHORIZATION AND CONSTRAINTS:
1. YOU MUST NOT decide if the prescription is appropriate.
2. YOU MUST NOT invent medical treatment instructions.
3. YOU MUST NOT suppress or override the extraction contents.
4. YOU MUST NOT provide medical recommendations (do not tell users to start/stop medications, change doses, etc.).
5. YOU MUST NOT invent diagnoses or conditions.
6. The summary MUST be exactly 1 to 2 sentences long.
7. Use informational language like "This prescription appears to contain..." or "A prescription for..."
8. If the contents are highly uncertain, state that the extraction was uncertain.

EXTRACTION CONTENTS:
${JSON.stringify(candidates, null, 2)}

Provide the 1-2 sentence summary now (plain text only, no markdown):`;

  try {
    if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const modelName = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
      
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt,
          stream: false,
          options: { temperature: 0.1 }
        })
      });
      
      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const data = await res.json();
      return data.response?.trim() || defaultSummary;
    } else {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY missing');
      }
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = process.env.GEMINI_MODEL_TEXT || 'gemini-3.6-flash';
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.1 } });
      const result = await model.generateContent(prompt);
      return result.response.text().trim() || defaultSummary;
    }
  } catch (err) {
    console.error('Failed to generate AI summary:', err);
    return defaultSummary;
  }
}
