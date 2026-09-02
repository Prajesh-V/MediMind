'use server'

import { createClient } from '@/utils/supabase/server'
import { createMedication } from './medication'
import type { CreateMedicationInput } from './medication'
import { revalidatePath } from 'next/cache'

export interface CreatePrescriptionInput {
  doctorName?: string
  facilityName?: string
  prescriptionDate?: string
  title?: string
  notes?: string
  candidates: Array<{
    rawName: string
    rawDosage?: string
    rawFrequency?: string
    rawInstructions?: string
    suggestedRxcui?: string
    suggestedName?: string
    verificationStatus?: string
  }>
}

export async function createPrescription(input: CreatePrescriptionInput) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 1. Insert into prescriptions
  const { data: prescription, error: pErr } = await supabase
    .from('prescriptions')
    .insert({
      patient_id: user.id,
      doctor_name: input.doctorName || null,
      facility_name: input.facilityName || null,
      title: input.title || null,
      prescription_date: input.prescriptionDate || new Date().toISOString().split('T')[0],
      notes: input.notes || null
    })
    .select()
    .single()

  if (pErr || !prescription) {
    return { success: false, error: pErr?.message || 'Failed to create prescription.' }
  }

  // 2. Insert candidates
  if (input.candidates && input.candidates.length > 0) {
    const candidateRows = input.candidates.map((c) => ({
      prescription_id: prescription.id,
      raw_name: c.rawName,
      raw_dosage: c.rawDosage || null,
      raw_frequency: c.rawFrequency || null,
      raw_instructions: c.rawInstructions || null,
      suggested_rxcui: c.suggestedRxcui || null,
      suggested_name: c.suggestedName || null,
      status: 'pending'
    }))

    const { error: cErr } = await supabase
      .from('prescription_candidates')
      .insert(candidateRows)

    if (cErr) {
      console.error('Error inserting prescription candidates:', cErr)
    }
  }

  revalidatePath('/patient/prescriptions')
  return { success: true, prescription }
}

export async function confirmPrescriptionCandidate(
  candidateId: string,
  medicationInput: CreateMedicationInput
) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 1. Create the confirmed patient medication
  const res = await createMedication(medicationInput)
  if (!res.success || !res.medication) {
    return { success: false, error: res.error || 'Failed to create medication.' }
  }

  // 2. Mark candidate as confirmed and link medication ID
  const { error: updateErr } = await supabase
    .from('prescription_candidates')
    .update({
      status: 'confirmed',
      confirmed_medication_id: res.medication.id
    })
    .eq('id', candidateId)

  if (updateErr) {
    console.error('Error updating candidate status:', updateErr)
  }

  revalidatePath('/patient/prescriptions')
  revalidatePath('/patient/medications')
  return { success: true, medication: res.medication }
}

export async function rejectPrescriptionCandidate(candidateId: string) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('prescription_candidates')
    .update({ status: 'rejected' })
    .eq('id', candidateId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/patient/prescriptions')
  return { success: true }
}
