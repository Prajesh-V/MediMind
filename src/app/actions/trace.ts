'use server';

import { createClient } from '@/utils/supabase/server';
import type { ClinicalTraceEvent } from '@/services/medical/types';

/**
 * Fetch trace events for a specific patient and optionally a specific assessment.
 * Applies proper auth checks (patient can view own, professional can view connected).
 */
export async function getTraceEvents(patientId: string, assessmentId?: string): Promise<ClinicalTraceEvent[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Auth validation: If not the patient, verify active professional connection
  if (user.id !== patientId) {
    const { data: connection, error: connErr } = await supabase
      .from('patient_professional_connections')
      .select('id')
      .eq('professional_id', user.id)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .single();

    if (connErr || !connection) {
      throw new Error('Forbidden: No active connection with patient');
    }
  }

  // Fetch events using authenticated client (RLS applies)
  let query = supabase
    .from('clinical_trace_events')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (assessmentId) {
    query = query.eq('assessment_id', assessmentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch trace events:', error);
    throw new Error('Failed to load assessment details');
  }

  return data as ClinicalTraceEvent[];
}
