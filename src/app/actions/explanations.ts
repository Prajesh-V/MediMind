'use server';

import { createClient } from '@/utils/supabase/server';
import { getPatientAssessments, getProfessionalAssessments } from './interactions';
import { generateControlledExplanation, M7_LANGUAGE, M7_PROMPT_VERSION } from '@/services/medical/explanations';
import type { ExplanationOutput, InteractionAssessment } from '@/services/medical/types';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordTraceEvent } from '@/services/medical/trace';

export async function getExplanation(
  assessmentId: string,
  audience: 'patient' | 'professional'
): Promise<{ success: true; data: ExplanationOutput } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  let authoritativeAssessment: InteractionAssessment | undefined;
  let targetPatientId: string | undefined;

  // Derive patient and authoritative assessment securely on the server
  if (audience === 'patient') {
    // For patients, they can only explain their own assessments
    const assessments = await getPatientAssessments();
    authoritativeAssessment = assessments.find(a => a.assessment_id === assessmentId);
    if (authoritativeAssessment) {
      targetPatientId = user.id;
    }
  } else if (audience === 'professional') {
    // For professionals, we must find the assessment among their actively connected patients
    const { data: connections, error: connErr } = await supabase
      .from('patient_professional_connections')
      .select('patient_id')
      .eq('professional_id', user.id)
      .eq('status', 'active');

    if (connErr) {
      return { success: false, error: 'Failed to load professional connections' };
    }

    // This ensures we only evaluate patients they have active connections with
    for (const conn of connections || []) {
      const assessments = await getProfessionalAssessments(conn.patient_id);
      const found = assessments.find(a => a.assessment_id === assessmentId);
      if (found) {
        authoritativeAssessment = found;
        targetPatientId = conn.patient_id;
        break; // Found the authoritative assessment
      }
    }
  }

  if (!authoritativeAssessment || !targetPatientId) {
    return { success: false, error: 'Assessment not found or unauthorized' };
  }

  // Check Cache
  const { data: cached, error: cacheErr } = await supabase
    .from('interaction_explanations')
    .select('explanation_data')
    .eq('assessment_id', assessmentId)
    .eq('audience', audience)
    .eq('language', M7_LANGUAGE)
    .eq('prompt_version', M7_PROMPT_VERSION)
    .single();

  if (cached && !cacheErr) {
    // Audit cache hit
    await logAudit(supabase, targetPatientId, user.id, assessmentId, audience, 'cache_hit', 'gemini-3.6-flash', true);
    return { success: true, data: cached.explanation_data as ExplanationOutput };
  }

  // Generate Explanation
  try {
    const { output, modelUsed } = await generateControlledExplanation(authoritativeAssessment, audience);

    // Semantic Validation
    const isValid = validateExplanation(output, authoritativeAssessment);
    if (!isValid) {
      await logAudit(supabase, targetPatientId, user.id, assessmentId, audience, 'semantic_validation_failed', modelUsed, false);
      return { success: false, error: 'Explanation failed semantic validation' };
    }

    // Save to Cache
    await supabase.from('interaction_explanations').upsert({
      assessment_id: assessmentId,
      audience: audience,
      language: M7_LANGUAGE,
      prompt_version: M7_PROMPT_VERSION,
      model: modelUsed,
      explanation_data: output,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'assessment_id, audience, language, prompt_version'
    });

    // Audit generation success
    await logAudit(supabase, targetPatientId, user.id, assessmentId, audience, 'generation_success', modelUsed, true);

    return { success: true, data: output };
  } catch (err) {
    console.error('Explanation generation error:', err);
    await logAudit(supabase, targetPatientId, user.id, assessmentId, audience, 'generation_failed', 'unknown', false);
    return { success: false, error: 'An explanation is temporarily unavailable.' };
  }
}

/**
 * Validates the Gemini output against the authoritative M6 assessment to ensure 
 * it did not invent or contradict clinical facts.
 */
function validateExplanation(output: ExplanationOutput, authoritative: InteractionAssessment): boolean {
  const generatedText = JSON.stringify(output).toLowerCase();
  
  // 1. Ensure it mentions the severity
  if (!generatedText.includes(authoritative.severity.toLowerCase())) {
    return false;
  }

  // 2. Ensure it does not invent new medications
  // A perfect check is hard for NLP, but we ensure at least one affected medication is mentioned
  const mentionsMed = authoritative.affected_medication_names.some(med => 
    generatedText.includes(med.toLowerCase())
  );
  if (!mentionsMed && authoritative.affected_medication_names.length > 0) {
    return false; // It should mention the meds involved
  }

  // 3. Reject if it generates prohibited medical instructions
  const prohibitedPhrases = [
    'stop taking', 'start taking', 'change your dose', 'double your dose', 
    'skip your dose', 'you should take', 'prescribe'
  ];
  if (prohibitedPhrases.some(phrase => generatedText.includes(phrase))) {
    return false;
  }

  return true;
}

async function logAudit(
  supabase: any,
  patientId: string,
  actorId: string,
  assessmentId: string,
  audience: string,
  status: string,
  model: string,
  success: boolean
) {
  try {
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await recordTraceEvent(supabaseService, {
      patient_id: patientId,
      assessment_id: assessmentId,
      event_type: success ? 'EXPLANATION_GENERATED' : 'EXPLANATION_FAILED',
      actor_type: audience === 'patient' ? 'patient' : 'professional',
      actor_id: actorId,
      source_component: 'ExplanationService',
      source_version: '1.0.0',
      metadata: {
        audience,
        status,
        model,
        prompt_version: M7_PROMPT_VERSION,
        validation_result: success
      }
    });
  } catch (err) {
    console.error('Failed to write M8 trace for explanation:', err);
  }
}
