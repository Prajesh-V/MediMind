'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { extractPrescription as extractPrescriptionService } from '@/services/multimodal/ocr';
import { extractFoodImage as extractFoodImageService } from '@/services/multimodal/vision';
import { generatePrescriptionSummary } from '@/services/multimodal/summary';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordTraceEvent } from '@/services/medical/trace';

export async function extractPrescription(
  documentId: string, 
  patientId: string, 
  title?: string, 
  prescriptionDate?: string
) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Unauthorized');

  // Verify document exists and fetch storage path
  const { data: doc, error: docError } = await supabase
    .from('uploaded_documents')
    .select('storage_path, patient_id')
    .eq('id', documentId)
    .single();

  if (docError || !doc) throw new Error('Document not found');
  
  // RLS ensures only connected professionals or the patient can read, but we double-verify patient match
  if (doc.patient_id !== patientId) throw new Error('Document does not belong to patient');

  // Download the file from storage securely server-side
  const { data: fileData, error: downloadError } = await supabase.storage.from('multimodal_uploads').download(doc.storage_path);
  if (downloadError || !fileData) throw new Error('Failed to download document from storage');
  
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Determine mime type (heuristic, should ideally save in DB)
  let mimeType = 'image/jpeg';
  if (doc.storage_path.endsWith('.png')) mimeType = 'image/png';
  if (doc.storage_path.endsWith('.pdf')) mimeType = 'application/pdf';

  // 1. Create a parent prescription row required by the schema BEFORE extraction
  const { data: prescription, error: prescriptionError } = await supabase
    .from('prescriptions')
    .insert({
      patient_id: patientId,
      title: title || 'Uploaded Prescription',
      prescription_date: prescriptionDate || new Date().toISOString().split('T')[0],
      notes: 'Imported via OCR document upload',
      file_path: doc.storage_path
    })
    .select('id')
    .single();

  if (prescriptionError || !prescription) {
    console.error('Failed to create parent prescription:', prescriptionError);
    throw new Error('Database persistence failed for prescription');
  }

  // Create extraction run (pending)
  const { data: run, error: runError } = await supabase
    .from('extraction_runs')
    .insert({
      document_id: documentId,
      service_provider: process.env.AI_PROVIDER === 'ollama' ? 'ollama-qwen2.5vl:3b' : 'gemini-3.6-flash',
      status: 'pending'
    })
    .select('id')
    .single();

  if (runError) throw new Error('Failed to create extraction run');

  // Call OCR service
  const result = await extractPrescriptionService(buffer, mimeType);

  // Update run status
  await supabase
    .from('extraction_runs')
    .update({ status: result.status })
    .eq('id', run.id);

  // If successful, map to prescription candidates
  if (result.status === 'success' && result.candidates.length > 0) {
    const candidatesToInsert = result.candidates.map(c => ({
      prescription_id: prescription.id,
      extraction_run_id: run.id,
      raw_name: c.medication_name?.value || 'Unknown',
      suggested_rxcui: c.rxcui_match || null,
      suggested_name: c.medication_name?.value || 'Unknown',
      raw_dosage: c.dosage?.value || null,
      raw_frequency: c.frequency?.value || null,
      status: 'pending', // existing candidate_status
      extraction_confidence: c.medication_name?.confidence || 'low',
      extraction_warnings: result.warnings
    }));

    const { error: insertError } = await supabase.from('prescription_candidates').insert(candidatesToInsert);
    if (insertError) {
      console.error('Failed to insert prescription candidates into database:', insertError);
      
      // Update the run status to reflect the persistence failure
      await supabase.from('extraction_runs').update({ status: 'failed' }).eq('id', run.id);
      
      return { extractionRunId: run.id, status: 'failed', error: 'Database persistence failed for candidates' };
    }

    // Generate AI Summary (isolated persistence step)
    let aiSummary = `Extracted ${result.candidates.length} medication(s).`;
    try {
      const provider = process.env.AI_PROVIDER === 'ollama' ? 'ollama' : 'gemini';
      aiSummary = await generatePrescriptionSummary(result.candidates, provider);
    } catch (e) {
      console.error('AI summary generation failed (fallback used):', e);
    }

    // Update prescription with summary
    await supabase.from('prescriptions').update({ ai_summary: aiSummary }).eq('id', prescription.id);
  }

  revalidatePath('/patient/medications');
  revalidatePath('/patient/prescriptions');
  return { extractionRunId: run.id, status: result.status };
}

export async function extractFoodImage(documentId: string, patientId: string) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Unauthorized');

  const { data: doc, error: docError } = await supabase
    .from('uploaded_documents')
    .select('storage_path, patient_id')
    .eq('id', documentId)
    .single();

  if (docError || !doc) throw new Error('Document not found');
  if (doc.patient_id !== patientId) throw new Error('Document does not belong to patient');

  // Download the file from storage securely server-side
  const { data: fileData, error: downloadError } = await supabase.storage.from('multimodal_uploads').download(doc.storage_path);
  if (downloadError || !fileData) throw new Error('Failed to download document from storage');
  
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Determine mime type
  let mimeType = 'image/jpeg';
  if (doc.storage_path.endsWith('.png')) mimeType = 'image/png';

  const { data: run, error: runError } = await supabase
    .from('extraction_runs')
    .insert({
      document_id: documentId,
      service_provider: 'gemini-2.5-flash',
      status: 'pending'
    })
    .select('id')
    .single();

  if (runError) throw new Error('Failed to create extraction run');

  const result = await extractFoodImageService(buffer, mimeType);

  await supabase
    .from('extraction_runs')
    .update({ status: result.status })
    .eq('id', run.id);

  if (result.status === 'success' && result.components.length > 0) {
    const componentsToInsert = result.components.map(c => ({
      patient_id: patientId,
      extraction_run_id: run.id,
      component_name: c.component_name,
      confidence_score: c.confidence_score,
      status: 'pending'
    }));

    await supabase.from('food_intake_candidates').insert(componentsToInsert);
  }

  revalidatePath('/patient/diet');
  return { extractionRunId: run.id, status: result.status };
}

/**
 * Confirms a staged food component candidate into canonical dietary intake.
 * This is the Golden Invariant transition point.
 */
export async function confirmFoodCandidate(candidateId: string, editedName?: string) {
  const supabase = await createClient();
  
  // 1. Fetch Candidate
  const { data: candidate, error: fetchError } = await supabase
    .from('food_intake_candidates')
    .select('*')
    .eq('id', candidateId)
    .single();

  if (fetchError || !candidate) throw new Error('Candidate not found');

  // 2. Mark Candidate Confirmed
  await supabase
    .from('food_intake_candidates')
    .update({ status: 'confirmed' })
    .eq('id', candidateId);

  // 3. Insert Canonical Intake
  const finalName = editedName || candidate.component_name;
  const { error: insertError } = await supabase
    .from('patient_dietary_intake')
    .insert({
      patient_id: candidate.patient_id,
      component_name: finalName,
      provenance_candidate_id: candidate.id
    });

  if (insertError) throw new Error('Failed to create canonical intake record');

  try {
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await recordTraceEvent(supabaseService, {
      patient_id: candidate.patient_id,
      event_type: 'INPUT_CONFIRMED',
      actor_type: 'patient',
      actor_id: candidate.patient_id,
      source_component: 'FoodCandidateConfirmation',
      source_version: '1.0.0',
      metadata: { action: 'confirmFoodCandidate', candidate_id: candidate.id, component_name: finalName }
    });
  } catch (err) {
    console.error('Failed to record trace event for food confirmation:', err);
  }

  revalidatePath('/patient/diet');
  return { success: true };
}
