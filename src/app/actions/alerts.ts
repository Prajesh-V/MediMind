'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { computeAssessmentsForPatient } from './interactions';

// Create a service client that bypasses RLS for materialization ONLY
const getServiceClient = () => {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export type AlertAudience = 'PATIENT' | 'PROFESSIONAL';
export type AlertSourceType = 'M6_INTERACTION' | 'M7_SYMPTOM' | 'M10_PATTERN' | 'M9_STALE';
export type AlertStatus = 'ACTIVE' | 'RESOLVED_AUTO';
export type AlertPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertPayload {
  source_type: AlertSourceType;
  source_id: string;
  audience: AlertAudience;
  status: AlertStatus;
  priority: AlertPriority;
  snapshot: any;
}

export interface PatientAlert {
  id: string;
  patient_id: string;
  audience: AlertAudience;
  source_type: AlertSourceType;
  source_id: string;
  status: AlertStatus;
  priority: AlertPriority;
  snapshot: any;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/**
 * Determines M9 stale state natively
 */
async function getM9StaleStates(supabase: any, patientId: string, currentAssessments: any[]): Promise<any[]> {
  if (currentAssessments.length === 0) return [];
  
  const { data: acks, error } = await supabase
    .from('clinical_acknowledgments')
    .select('*')
    .eq('patient_id', patientId)
    .in('assessment_id', currentAssessments.map(a => a.assessment_id));
    
  if (error) {
    console.error("Failed to fetch acknowledgments", error);
    return [];
  }
  
  const staleAssessments: any[] = [];
  const ackMap = new Map((acks || []).map((a: any) => [a.assessment_id, a]));
  
  for (const a of currentAssessments) {
    const ack = ackMap.get(a.assessment_id) as any;
    if (ack && ack.state_fingerprint !== (a as any).state_fingerprint) {
      staleAssessments.push({
        assessment: a,
        ack
      });
    }
  }
  
  return staleAssessments;
}

/**
 * Deterministic Orchestrator for Materialization
 */
export async function recalculatePatientAlerts(patientId: string): Promise<void> {
  const supabase = getServiceClient();

  // 1. Fetch current generation for OCC
  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('alert_generation')
    .eq('id', patientId)
    .single();

  if (pErr || !patient) {
    console.error(`Failed to get patient generation for ${patientId}`, pErr);
    return;
  }
  const expectedGeneration = patient.alert_generation;

  // 2. Fetch authoritative sources
  const currentAssessments = await computeAssessmentsForPatient(patientId);
  const m9Stales = await getM9StaleStates(supabase, patientId, currentAssessments);
  
  const { data: symptoms } = await supabase
    .from('patient_symptom_reports')
    .select(`
      id, symptom, severity, onset_at, 
      patient_medications(id, display_name)
    `)
    .eq('patient_id', patientId);
    
  const { data: patterns } = await supabase
    .from('longitudinal_patterns')
    .select('*')
    .eq('patient_id', patientId);

  // 3. Materialize Payloads
  const payloads: AlertPayload[] = [];
  
  // -- M6 Materializer
  const activeM6AssessmentIds = new Set<string>();
  for (const assessment of currentAssessments) {
    activeM6AssessmentIds.add(assessment.assessment_id);
    
    // Patient Alert
    if (assessment.interaction_type === 'medication-food') {
      payloads.push({
        source_type: 'M6_INTERACTION',
        source_id: assessment.assessment_id,
        audience: 'PATIENT',
        status: 'ACTIVE',
        priority: assessment.severity === 'high' ? 'HIGH' : 'MEDIUM',
        snapshot: {
          state_fingerprint: assessment.state_fingerprint,
          title: `Interaction: ${assessment.affected_medication_names.join(', ')} and ${assessment.affected_food_components?.join(', ')}`,
          severity: assessment.severity,
          summary: assessment.effect
        }
      });
    }
    
    // Professional Alert
    payloads.push({
      source_type: 'M6_INTERACTION',
      source_id: assessment.assessment_id,
      audience: 'PROFESSIONAL',
      status: 'ACTIVE',
      priority: assessment.severity === 'high' ? 'HIGH' : 'MEDIUM',
      snapshot: {
        state_fingerprint: assessment.state_fingerprint,
        title: `Interaction: ${assessment.affected_medication_names.join(', ')}`,
        severity: assessment.severity,
        summary: assessment.effect
      }
    });
  }
  
  // Determine missing M6 -> RESOLVED_AUTO
  const { data: existingM6Alerts } = await supabase
    .from('system_alerts')
    .select('source_id, audience')
    .eq('patient_id', patientId)
    .eq('source_type', 'M6_INTERACTION')
    .eq('status', 'ACTIVE');
    
  if (existingM6Alerts) {
    for (const ea of existingM6Alerts) {
      if (!activeM6AssessmentIds.has(ea.source_id)) {
        payloads.push({
          source_type: 'M6_INTERACTION',
          source_id: ea.source_id,
          audience: ea.audience,
          status: 'RESOLVED_AUTO',
          priority: 'LOW',
          snapshot: {}
        });
      }
    }
  }

  // -- M9 Stale Materializer
  const staleAssessmentIds = new Set<string>();
  for (const stale of m9Stales) {
    staleAssessmentIds.add(stale.assessment.assessment_id);
    payloads.push({
      source_type: 'M9_STALE',
      source_id: stale.assessment.assessment_id,
      audience: 'PROFESSIONAL',
      status: 'ACTIVE',
      priority: 'HIGH', // Requires attention
      snapshot: {
        current_fingerprint: stale.assessment.state_fingerprint,
        acknowledged_fingerprint: stale.ack.state_fingerprint,
        title: `Stale Review: ${stale.assessment.affected_medication_names.join(', ')}`
      }
    });
  }
  
  // Resolve existing M9 if no longer stale
  const { data: existingM9Alerts } = await supabase
    .from('system_alerts')
    .select('source_id')
    .eq('patient_id', patientId)
    .eq('source_type', 'M9_STALE')
    .eq('status', 'ACTIVE');
    
  if (existingM9Alerts) {
    for (const ea of existingM9Alerts) {
      if (!staleAssessmentIds.has(ea.source_id)) {
        payloads.push({
          source_type: 'M9_STALE',
          source_id: ea.source_id,
          audience: 'PROFESSIONAL',
          status: 'RESOLVED_AUTO',
          priority: 'LOW',
          snapshot: {}
        });
      }
    }
  }

  // -- M7 Symptom Materializer (Static)
  if (symptoms) {
    for (const sym of symptoms) {
      let title = `Patient reported ${sym.symptom}`;
      const med = Array.isArray(sym.patient_medications) ? sym.patient_medications[0] : sym.patient_medications;
      if (med) {
        title = `Patient reported ${sym.symptom} while taking ${med.display_name}`;
      }
      
      payloads.push({
        source_type: 'M7_SYMPTOM',
        source_id: sym.id,
        audience: 'PROFESSIONAL',
        status: 'ACTIVE',
        priority: sym.severity === 'severe' ? 'HIGH' : 'MEDIUM',
        snapshot: {
          title,
          severity: sym.severity,
          symptom: sym.symptom,
          related_medication: med?.display_name || null
        }
      });
    }
  }
  
  // -- M10 Pattern Materializer
  if (patterns) {
    for (const p of patterns) {
      if (p.professional_ack_at) {
        payloads.push({
          source_type: 'M10_PATTERN',
          source_id: p.id,
          audience: 'PROFESSIONAL',
          status: 'RESOLVED_AUTO',
          priority: 'LOW',
          snapshot: {}
        });
      } else {
        payloads.push({
          source_type: 'M10_PATTERN',
          source_id: p.id,
          audience: 'PROFESSIONAL',
          status: 'ACTIVE',
          priority: p.confidence > 0.8 ? 'HIGH' : 'MEDIUM',
          snapshot: {
            title: `Pattern Detected: ${p.pattern_type}`,
            pattern_fingerprint: p.pattern_fingerprint,
            confidence: p.confidence
          }
        });
      }
    }
  }

  // 4. Commit via RPC (OCC locked)
  if (payloads.length === 0) return;

  const { error: rpcErr } = await supabase.rpc('commit_patient_alerts', {
    p_patient_id: patientId,
    p_expected_generation: expectedGeneration,
    p_alerts_payload: payloads
  });

  if (rpcErr) {
    console.error(`OCC materialization failed for ${patientId}`, rpcErr);
    throw rpcErr; // Propagates so calling layer can log, but usually inside a safe catch block
  }
}

/**
 * Explicit Reconciler Endpoint
 */
export async function triggerAlertReconciliation(targetPatientId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let patientId = targetPatientId;
  
  if (!targetPatientId) {
    // If no target is specified, the user MUST be a patient to reconcile themselves
    if (user.user_metadata?.role !== 'patient') {
      return;
    }
    // Implicitly it's a patient reconciling themselves
    patientId = user.id;
  } else {
    // Might be a professional. Validate connection.
    if (user.id !== targetPatientId) {
      const { data: conn } = await supabase
        .from('patient_professional_connections')
        .select('id')
        .eq('professional_id', user.id)
        .eq('patient_id', targetPatientId)
        .eq('status', 'active')
        .single();
        
      if (!conn) {
        throw new Error('Forbidden: Not actively connected to patient');
      }
    }
  }

  if (!patientId) return;

  // Run the safe deterministic materializer
  await recalculatePatientAlerts(patientId).catch(err => {
    // Expected OCC race (harmless, another request won the race)
    if (err.message && (err.message.includes('Stale generation') || err.message.includes('Concurrency error'))) {
      console.warn(`[OCC] Safe concurrency abort during reconciliation for ${patientId}: ${err.message}`);
      return;
    }
    
    // Unexpected errors should not be silently swallowed
    console.error("Reconciliation failed with unexpected error:", err);
    throw err;
  });
}

/**
 * Read API for Patients
 */
export async function getPatientAlerts(): Promise<PatientAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('system_alerts')
    .select('*')
    .eq('audience', 'PATIENT')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as PatientAlert[];
}

/**
 * Read API for Professionals
 */
export async function getProfessionalAlerts(patientId: string): Promise<PatientAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('system_alerts')
    .select('*')
    .eq('audience', 'PROFESSIONAL')
    .eq('patient_id', patientId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as PatientAlert[];
}

/**
 * RPC Mutation wrappers
 */
export async function markAlertRead(alertId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_alert_read', { p_alert_id: alertId });
  if (error) throw error;
}

export async function acknowledgeAlert(alertId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('acknowledge_alert', { p_alert_id: alertId });
  if (error) throw error;
}

/**
 * JIT Reminders Projection (M3)
 */
export async function getPatientReminders(patientId: string, windowStartUtcMs: number, windowEndUtcMs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== patientId) {
    throw new Error('Unauthorized');
  }

  const startDate = new Date(windowStartUtcMs).toISOString();
  const endDate = new Date(windowEndUtcMs).toISOString();

  const { data, error } = await supabase
    .from('scheduled_doses')
    .select(`
      id,
      scheduled_time,
      status,
      dose_amount,
      dose_unit,
      patient_medications (
        id,
        display_name,
        instructions
      )
    `)
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .gte('scheduled_time', startDate)
    .lte('scheduled_time', endDate)
    .order('scheduled_time', { ascending: true });

  if (error) throw error;
  return data;
}
