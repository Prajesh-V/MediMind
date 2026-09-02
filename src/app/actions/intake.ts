'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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
