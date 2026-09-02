'use server';

import { createClient } from '@/utils/supabase/server';
import { getProfessionalAssessments } from './interactions';
import type { PatientEvaluationContext, InteractionAssessment } from '@/services/medical/types';
import { revalidatePath } from 'next/cache';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordTraceEvent } from '@/services/medical/trace';

export type ReviewState = 'UNREVIEWED' | 'REVIEWED' | 'SUPERSEDED';

export interface WorkspaceAssessment extends InteractionAssessment {
  review_state: ReviewState;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface WorkspaceContext {
  patient_id: string;
  patient_name?: string;
  medications: PatientEvaluationContext['medications'];
  dietary_records: PatientEvaluationContext['dietary_records'];
  assessments: WorkspaceAssessment[];
}

/**
 * Retrieves the comprehensive canonical M9 workspace state for a given patient.
 * Enforces active professional connection.
 */
export async function getWorkspaceContext(patientId: string): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Unauthorized');

  // Verify connection (defense in depth, though getProfessionalAssessments also checks)
  const { data: connection, error: connErr } = await supabase
    .from('patient_professional_connections')
    .select('id, patients(first_name, last_name)')
    .eq('professional_id', user.id)
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .single();

  if (connErr || !connection) {
    throw new Error('Forbidden: No active connection with this patient');
  }

  // 1. Fetch Authoritative Assessments
  const assessments = await getProfessionalAssessments(patientId);

  // 2. Fetch Acknowledgments for these assessments
  const { data: acks, error: ackErr } = await supabase
    .from('clinical_acknowledgments')
    .select('*')
    .eq('patient_id', patientId)
    .in('assessment_id', assessments.map(a => a.assessment_id));

  const ackMap = new Map((acks || []).map(a => [a.assessment_id, a]));

  const workspaceAssessments: WorkspaceAssessment[] = assessments.map(a => {
    const ack = ackMap.get(a.assessment_id);
    let review_state: ReviewState = 'UNREVIEWED';
    
    if (ack) {
      if (ack.state_fingerprint === a.state_fingerprint) {
        review_state = 'REVIEWED';
      } else {
        review_state = 'SUPERSEDED';
      }
    }

    return {
      ...a,
      review_state,
      acknowledged_at: ack?.acknowledged_at,
      acknowledged_by: ack?.professional_id
    };
  });

  // 3. Fetch Canonical Inputs
  const { data: meds } = await supabase.from('patient_medications').select('*').eq('patient_id', patientId).eq('is_active', true);
  const { data: diet } = await supabase.from('patient_dietary_intake').select('*').eq('patient_id', patientId);

  return {
    patient_id: patientId,
    patient_name: connection.patients ? `${(connection.patients as any).first_name} ${(connection.patients as any).last_name}` : 'Unknown',
    medications: meds || [],
    dietary_records: diet || [],
    assessments: workspaceAssessments
  };
}

/**
 * Acknowledges a specific assessment state fingerprint.
 */
export async function acknowledgeWorkspaceAssessment(
  patientId: string,
  assessmentId: string,
  stateFingerprint: string,
  ruleKey: string,
  severity: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return { success: false, error: 'Unauthorized' };

  // 1. Authoritative re-evaluation
  const authoritative = await getProfessionalAssessments(patientId);
  const target = authoritative.find(a => a.assessment_id === assessmentId);
  
  if (!target) return { success: false, error: 'Assessment not found' };
  
  // Do NOT trust the client fingerprint blindly. If the underlying data changed between the page load and this click, 
  // the client's fingerprint won't match the new authoritative one!
  if (target.state_fingerprint !== stateFingerprint) {
    return { success: false, error: 'Clinical data has changed since you opened this page. Please refresh and review the superseded assessment.' };
  }

  // 2. Perform Atomic Upsert & Trace Log via OCC retry loop in application logic
  let attempt = 0;
  const maxAttempts = 3;
  const supabaseService = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const event_timestamp = new Date().toISOString();
      const { prepareTracePayload } = await import('@/services/medical/trace');
      
      const tracePayload = await prepareTracePayload(supabaseService, {
        patient_id: patientId,
        assessment_id: assessmentId,
        event_type: 'PROFESSIONAL_ACKNOWLEDGED',
        actor_type: 'professional',
        actor_id: user.id,
        source_component: 'ClinicalWorkspace',
        source_version: '1.0.0',
        metadata: { rule_key: ruleKey, severity, state_fingerprint: stateFingerprint, notes }
      }, event_timestamp);

      // Execute atomic RPC with service role (so it has rights to insert into clinical_trace_events)
      const { error: rpcErr } = await supabaseService.rpc('acknowledge_assessment_atomic', {
        p_patient_id: patientId,
        p_assessment_id: assessmentId,
        p_state_fingerprint: stateFingerprint,
        p_notes: notes || null,
        p_trace_payload: tracePayload
      });

      if (rpcErr) {
        if (rpcErr.code === '23505' && rpcErr.message.includes('clinical_trace_events_patient_prev_hash_key')) {
          if (attempt < maxAttempts) continue; // OCC retry
        }
        console.error('Atomic acknowledgment failed:', rpcErr);
        return { success: false, error: 'Failed to record atomic acknowledgment' };
      }

      break; // Success
    } catch (err) {
      if (attempt >= maxAttempts) {
        console.error('Atomic acknowledgment failed after retries:', err);
        return { success: false, error: 'Failed to record atomic acknowledgment' };
      }
    }
  }

  revalidatePath(`/professional/workspace/${patientId}`);
  return { success: true };
}
