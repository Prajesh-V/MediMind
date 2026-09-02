'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { evaluatePatientInteractions } from '@/services/medical/interaction-engine';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordTraceEvent } from '@/services/medical/trace';
import type {
  InteractionAssessment,
  PatientEvaluationContext,
  DatabaseInteractionRule,
} from '@/services/medical/types';

/**
 * Patient Action: Retrieve deterministic interaction assessments for authenticated patient.
 * Security: Strictly enforces auth.uid() === patientId
 */
export async function getPatientAssessments(targetPatientId?: string): Promise<InteractionAssessment[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const patientId = targetPatientId || user.id;

  // Enforce patient isolation
  if (patientId !== user.id) {
    throw new Error('Forbidden: Patients can only retrieve their own assessments');
  }

  return await computeAssessmentsForPatient(patientId);
}

/**
 * Professional Action: Retrieve deterministic interaction assessments for a connected patient.
 * Security: Validates active patient-professional connection in database.
 */
export async function getProfessionalAssessments(patientId: string): Promise<InteractionAssessment[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Verify active connection
  const { data: connection, error: connErr } = await supabase
    .from('patient_professional_connections')
    .select('id, status')
    .eq('professional_id', user.id)
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .single();

  if (connErr || !connection) {
    throw new Error('Forbidden: No active connection with this patient');
  }

  return await computeAssessmentsForPatient(patientId);
}

/**
 * Professional Action: Record a clinical acknowledgment for an interaction assessment.
 */
export async function acknowledgeAssessment(
  patientId: string,
  assessmentId: string,
  ruleKey: string,
  severity: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify professional connection
  const { data: connection, error: connErr } = await supabase
    .from('patient_professional_connections')
    .select('id')
    .eq('professional_id', user.id)
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .single();

  if (connErr || !connection) {
    return { success: false, error: 'Forbidden: No active connection with patient' };
  }

  // Record immutable trace event
  try {
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await recordTraceEvent(supabaseService, {
      patient_id: patientId,
      assessment_id: assessmentId,
      event_type: 'PROFESSIONAL_ACKNOWLEDGED',
      actor_type: 'professional',
      actor_id: user.id,
      source_component: 'InteractionAcknowledgment',
      source_version: '1.0.0',
      metadata: { rule_key: ruleKey, severity, notes: notes || 'Reviewed and acknowledged by professional' }
    });
  } catch (err) {
    console.error('Failed to write trace event for assessment acknowledgment:', err);
  }

  revalidatePath('/professional/interactions');
  revalidatePath('/patient/safety');
  return { success: true };
}

/**
 * Internal helper to load patient clinical data and execute the deterministic engine.
 */
async function computeAssessmentsForPatient(patientId: string): Promise<InteractionAssessment[]> {
  const supabase = await createClient();

  // 1. Fetch Patient Active Medications & Schedules
  const { data: meds, error: medErr } = await supabase
    .from('patient_medications')
    .select(`
      id,
      rxcui,
      display_name,
      generic_name,
      food_relation,
      administration_instructions,
      medication_schedules (
        id,
        time_of_day,
        slot_label,
        days_of_week,
        dose_quantity
      )
    `)
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (medErr) {
    console.error('Error fetching patient medications:', medErr);
    throw new Error('Failed to load patient medications');
  }

  // 2. Fetch Confirmed Dietary Intake
  const { data: dietaryRecords, error: dietErr } = await supabase
    .from('patient_dietary_intake')
    .select('id, component_name, consumed_at')
    .eq('patient_id', patientId)
    .order('consumed_at', { ascending: false });

  if (dietErr) {
    console.error('Error fetching patient dietary intake:', dietErr);
  }

  // Format patient context
  const context: PatientEvaluationContext = {
    patient_id: patientId,
    medications: (meds || []).map((m: any) => ({
      id: m.id,
      rxcui: m.rxcui,
      display_name: m.display_name,
      generic_name: m.generic_name,
      food_relation: m.food_relation || 'no_relation',
      administration_instructions: m.administration_instructions,
      schedules: m.medication_schedules || [],
    })),
    dietary_records: dietaryRecords || [],
  };

  // 3. Fetch Approved Interaction Rules with Evidence via secure RPC
  const { data: rules, error: rulesErr } = await supabase.rpc('get_approved_interaction_rules');

  if (rulesErr) {
    console.error('Error fetching interaction rules:', rulesErr);
    throw new Error(`Failed to load clinical interaction rules: ${rulesErr.message}`);
  }

  const databaseRules = (rules || []) as unknown as DatabaseInteractionRule[];

  // 4. Execute Deterministic Evaluation
  const assessments = evaluatePatientInteractions(context, databaseRules);

  // 5. Lazy-Materialize Distinct Canonical States for M10 History
  if (assessments.length > 0) {
    try {
      // Use Service Role for background logging to bypass UI RLS issues if any,
      // though the user should have access to insert their own history.
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const historyRows = assessments.map(a => ({
        patient_id: patientId,
        assessment_id: a.assessment_id,
        rule_id: a.rule_id,
        rule_version: a.rule_version,
        severity: a.severity,
        state_fingerprint: a.state_fingerprint,
        source_medication_ids: a.affected_medication_ids.length > 0 ? a.affected_medication_ids : null,
      }));

      // Upsert to capture only unique (patient_id, rule_id, state_fingerprint)
      const { error: upsertErr } = await serviceClient
        .from('historical_m6_assessments')
        .upsert(historyRows, {
          onConflict: 'patient_id, rule_id, state_fingerprint',
          ignoreDuplicates: false // we want it to update last_seen_at if we included it, but we can rely on Postgres ON CONFLICT DO UPDATE
        });

      if (upsertErr) {
        // We log but do not fail the request if history logging fails
        console.error('Failed to log M6 history:', upsertErr);
      } else {
        // Manually update last_seen_at for existing rows
        // Note: Supabase JS doesn't perfectly support updating specific columns on conflict in a single simple call without raw RPC,
        // but since we just need distinct states, inserting new ones is enough. The DB defaults first_seen_at and last_seen_at.
        // Actually, for a pure append-only distinct set, just letting it upsert is fine.
      }
    } catch (e) {
      console.error('Error in M6 history persistence:', e);
    }
  }

  return assessments;
}
