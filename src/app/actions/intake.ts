'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { triggerAlertReconciliation } from './alerts';

/**
 * Creates an uploaded_document record after the client uploads a file securely to Storage.
 * Note: Actual file binary upload to Storage bucket should happen via Signed URL from client,
 * but this action records the database entity for it.
 */
export async function registerUploadedDocument(
  patientId: string,
  storagePath: string,
  fileType: string,
  documentCategory: 'prescription' | 'food'
) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Unauthorized');
  }

  // Insert document record
  const { data, error } = await supabase
    .from('uploaded_documents')
    .insert({
      patient_id: patientId,
      storage_path: storagePath,
      file_type: fileType,
      document_category: documentCategory
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to register document:', error);
    throw new Error('Failed to register uploaded document');
  }

  revalidatePath('/patient/intake');
  return data.id;
}

import { authorizePatientAccess } from './connection';

/**
 * Retrieves the canonical confirmed dietary intake records for a patient.
 * Used by UI dashboards, interaction engine, and workspace.
 */
export async function getPatientDietaryRecords(patientId?: string) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Unauthorized');
  
  const targetPatientId = patientId || user.id;
  await authorizePatientAccess(targetPatientId);

  const { data, error } = await supabase
    .from('patient_dietary_intake')
    .select('*')
    .eq('patient_id', targetPatientId)
    .order('consumed_at', { ascending: false });

  if (error) {
    console.error('Error fetching patient dietary intake:', error);
    throw new Error('Failed to load dietary records');
  }

  return data || [];
}

/**
 * Logs a dietary intake record and triggers alert reconciliation.
 */
export async function logDietaryIntake(componentName: string, consumedAt: string) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('patient_dietary_intake')
    .insert({
      patient_id: user.id,
      component_name: componentName,
      consumed_at: consumedAt
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to log dietary intake:', error);
    throw new Error('Failed to log dietary intake');
  }

  // Trigger alert reconciliation safely
  try {
    await triggerAlertReconciliation(user.id);
  } catch (err) {
    console.error('Alert reconciliation failed during dietary log:', err);
  }

  revalidatePath('/patient/intake');
  return data;
}
