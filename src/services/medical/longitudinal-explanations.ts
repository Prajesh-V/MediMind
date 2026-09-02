import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LongitudinalPattern } from './types';

// Enforce M7 Controlled Boundary for M10 Patterns
export const M10_PROMPT_VERSION = '1.0.0';
export const M10_LANGUAGE = 'en';

export interface LongitudinalExplanationOutput {
  pattern_restatement: string;
  evidence_summary: string;
  clinical_context: string;
}

async function _generateLongitudinalExplanationViaGemini(
  pattern: LongitudinalPattern,
  audience: 'patient' | 'professional'
): Promise<{ output: LongitudinalExplanationOutput; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `
You are MediMind's deterministic pattern explanation layer.
Your ONLY role is to restate the provided structured pattern in human-readable language.
You are generating an explanation for a ${audience}.

CRITICAL BOUNDARIES:
- DO NOT invent new facts.
- DO NOT make diagnoses.
- DO NOT claim a medication is causing a condition.
- DO NOT recommend treatment changes (e.g., "stop taking", "start taking").
- DO NOT predict future complications.
- You must ONLY use the information provided in the 'Input Pattern' section.

Respond strictly in valid JSON matching this schema:
{
  "pattern_restatement": "A direct, clear sentence stating what the pattern is.",
  "evidence_summary": "A brief summary of the evidence that triggered this pattern.",
  "clinical_context": "Safe, governed context about why this type of pattern is tracked (do not make it specific to the patient's assumed condition)."
}
  `;

  const safePayload = {
    pattern_type: pattern.pattern_type,
    observation_window_days: pattern.observation_window_days,
    observation_count: pattern.observation_count,
    threshold_value: pattern.threshold_value,
    first_event_at: pattern.first_event_at,
    last_event_at: pattern.last_event_at,
    summary: pattern.deterministic_summary
  };

  const userPrompt = `
Input Pattern:
${JSON.stringify(safePayload, null, 2)}
  `;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });

  const response = await model.generateContent(userPrompt);
  const responseText = response.response.text();
  if (!responseText) throw new Error('Empty response from Gemini');

  try {
    const parsed = JSON.parse(responseText) as LongitudinalExplanationOutput;
    return { output: parsed, modelUsed: modelName };
  } catch (e) {
    throw new Error('Failed to parse Gemini explanation as JSON');
  }
}

async function _generateLongitudinalExplanationViaMistral(
  pattern: LongitudinalPattern,
  audience: 'patient' | 'professional'
): Promise<{ output: LongitudinalExplanationOutput; modelUsed: string }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }

  const modelName = 'mistral-medium-3-5';
  
  const safePayload = {
    pattern_type: pattern.pattern_type,
    observation_window_days: pattern.observation_window_days,
    observation_count: pattern.observation_count,
    threshold_value: pattern.threshold_value,
    first_event_at: pattern.first_event_at,
    last_event_at: pattern.last_event_at,
    summary: pattern.deterministic_summary
  };

  const prompt = `
You are MediMind's deterministic pattern explanation layer.
Your ONLY role is to restate the provided structured pattern in human-readable language.
You are generating an explanation for a ${audience}.

CRITICAL BOUNDARIES:
- DO NOT invent new facts.
- DO NOT make diagnoses.
- DO NOT claim a medication is causing a condition.
- DO NOT recommend treatment changes (e.g., "stop taking", "start taking").
- DO NOT predict future complications.
- You must ONLY use the information provided in the 'Input Pattern' section.
- Output MUST be valid JSON matching the schema.

Output JSON Schema:
{
  "pattern_restatement": "A direct, clear sentence stating what the pattern is.",
  "evidence_summary": "A brief summary of the evidence that triggered this pattern.",
  "clinical_context": "Safe, governed context about why this type of pattern is tracked (do not make it specific to the patient's assumed condition)."
}

Input Pattern:
${JSON.stringify(safePayload, null, 2)}
`;

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelName,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`Mistral M10 Explanation Failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const resultText = data.choices?.[0]?.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleanText) as LongitudinalExplanationOutput;
  return { output: parsed, modelUsed: modelName };
}

async function _generateLongitudinalExplanationViaOllama(
  pattern: LongitudinalPattern,
  audience: 'patient' | 'professional'
): Promise<{ output: LongitudinalExplanationOutput; modelUsed: string }> {
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
  
  const safePayload = {
    pattern_type: pattern.pattern_type,
    observation_window_days: pattern.observation_window_days,
    observation_count: pattern.observation_count,
    threshold_value: pattern.threshold_value,
    first_event_at: pattern.first_event_at,
    last_event_at: pattern.last_event_at,
    summary: pattern.deterministic_summary
  };

  const prompt = `
You are MediMind's deterministic pattern explanation layer.
Your ONLY role is to restate the provided structured pattern in human-readable language.
You are generating an explanation for a ${audience}.

CRITICAL BOUNDARIES:
- DO NOT invent new facts.
- DO NOT make diagnoses.
- DO NOT claim a medication is causing a condition.
- DO NOT recommend treatment changes (e.g., "stop taking", "start taking").
- DO NOT predict future complications.
- You must ONLY use the information provided in the 'Input Pattern' section.
- Output MUST be valid JSON matching the schema.

Output JSON Schema:
{
  "pattern_restatement": "A direct, clear sentence stating what the pattern is.",
  "evidence_summary": "A brief summary of the evidence that triggered this pattern.",
  "clinical_context": "Safe, governed context about why this type of pattern is tracked (do not make it specific to the patient's assumed condition)."
}

Input Pattern:
${JSON.stringify(safePayload, null, 2)}
`;

  let res;
  try {
    res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        format: 'json',
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
  } catch (e) {
    throw new Error('Ollama service unreachable. Is it running?');
  }

  if (!res.ok) {
    throw new Error(`Ollama M10 Explanation Failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const resultText = data.message?.content || '';
  const cleanText = resultText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleanText) as LongitudinalExplanationOutput;
  return { output: parsed, modelUsed: modelName };
}

export async function generateLongitudinalExplanation(
  pattern: LongitudinalPattern,
  audience: 'patient' | 'professional'
): Promise<{ output: LongitudinalExplanationOutput; modelUsed: string }> {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'ollama') {
    console.log('[AI_ROUTING] Attempting primary provider: Ollama');
    try {
      return await _generateLongitudinalExplanationViaOllama(pattern, audience);
    } catch (error) {
      console.error(`[AI_ROUTING] Ollama failure category: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('[AI_ROUTING] Falling back to secondary provider: Gemini');
      
      try {
        return await _generateLongitudinalExplanationViaGemini(pattern, audience);
      } catch (geminiError) {
        console.error('[AI_ROUTING] Gemini fallback failed:', geminiError);
        throw new Error('Failed to generate longitudinal explanation. Both primary (Ollama) and fallback (Gemini) providers failed.');
      }
    }
  }

  console.log('[AI_ROUTING] Attempting primary provider: Gemini');
  try {
    return await _generateLongitudinalExplanationViaGemini(pattern, audience);
  } catch (error) {
    console.error('[AI_ROUTING] Gemini failure:', error);
    throw new Error('Failed to generate longitudinal explanation using Gemini.');
  }
}
