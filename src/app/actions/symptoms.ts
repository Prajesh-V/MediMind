'use server';

import { createClient } from '@/utils/supabase/server';
import { authorizePatientAccess } from './connection';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { triggerAlertReconciliation } from './alerts';

export interface SymptomReport {
  id: string;
  patient_id: string;
  symptom: string;
  severity: 'mild' | 'moderate' | 'severe';
  onset_at: string;
  related_medication_id: string | null;
  notes: string | null;
  created_at: string;
}

export async function getPatientSymptomReports(patientId?: string): Promise<SymptomReport[]> {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Unauthorized');
  
  const targetPatientId = patientId || user.id;
  await authorizePatientAccess(targetPatientId);

  const { data, error } = await supabase
    .from('patient_symptom_reports')
    .select('*')
    .eq('patient_id', targetPatientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching symptom reports:', error);
    throw new Error('Failed to load symptom reports');
  }

  return data as SymptomReport[];
}

export async function createSymptomReport(
  symptom: string,
  severity: 'mild' | 'moderate' | 'severe',
  onsetAt: string,
  relatedMedicationId?: string | null,
  notes?: string | null
): Promise<{ success: boolean; data?: SymptomReport; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { success: false, error: 'Unauthorized' };

  if (!symptom || !symptom.trim()) {
    return { success: false, error: 'Symptom description is required.' };
  }

  if (!['mild', 'moderate', 'severe'].includes(severity)) {
    return { success: false, error: 'Invalid severity level.' };
  }

  const symptomId = crypto.randomUUID();
  const traceId = crypto.randomUUID();
  const eventTimestamp = new Date().toISOString();

  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_patient_symptom_report_atomic', {
    p_symptom_id: symptomId,
    p_symptom: symptom.trim(),
    p_severity: severity,
    p_onset_at: onsetAt,
    p_related_medication_id: relatedMedicationId || null,
    p_notes: notes?.trim() || null,
    p_trace_id: traceId,
    p_event_timestamp: eventTimestamp
  });

  if (rpcErr) {
    console.error('Error in atomic symptom creation:', rpcErr);
    return { success: false, error: rpcErr.message || 'Failed to save symptom report.' };
  }

  const { data, was_created } = rpcData as { data: SymptomReport, was_created: boolean };

  try {
    await triggerAlertReconciliation(user.id);
  } catch (err) {
    console.error('Alert reconciliation failed during symptom creation:', err);
  }

  revalidatePath('/patient/safety');
  return { success: true, data };
}
