'use server'

import { createClient } from '@/utils/supabase/server'
import { createMedication, projectScheduledDoses } from './medication'
import type { CreateMedicationInput } from './medication'
import { revalidatePath } from 'next/cache'
import { getRxNormProperties } from '@/services/rxnorm'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { recordTraceEvent } from '@/services/medical/trace'

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

  // 1. Resolve verification status and generic name (matching createMedication semantics)
  let verificationStatus = medicationInput.verificationStatus || 'unverified'
  let normalizedName = medicationInput.displayName
  let genericName = medicationInput.genericName

  if (medicationInput.rxcui) {
    const props = await getRxNormProperties(medicationInput.rxcui)
    if (props) {
      verificationStatus = 'verified_rxnorm'
      if (!genericName && props.name) {
        genericName = props.name
      }
    }
  }

  // 2. Call the Atomic RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_prescription_candidate_atomic', {
    p_candidate_id: candidateId,
    p_medication_payload: {
      rxcui: medicationInput.rxcui || null,
      display_name: normalizedName,
      generic_name: genericName || null,
      dosage_amount: medicationInput.dosageAmount || null,
      dosage_unit: medicationInput.dosageUnit || null,
      dosage_form: medicationInput.dosageForm || null,
      route: medicationInput.route || 'oral',
      food_relation: medicationInput.foodRelation || 'no_relation',
      administration_instructions: medicationInput.administrationInstructions || null,
      start_date: medicationInput.startDate || null,
      end_date: medicationInput.endDate || null,
      is_prn: medicationInput.isPrn ?? false,
      verification_status: verificationStatus
    }
  })

  if (rpcErr || !rpcData) {
    console.error('RPC Error:', rpcErr)
    return { success: false, error: rpcErr?.message || 'Failed to confirm candidate' }
  }

  const { medication, was_created } = rpcData as any

  // 3. Post-Creation Logistics (Only if newly created)
  if (was_created) {
    // Record Trace Event
    try {
      const supabaseService = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await recordTraceEvent(supabaseService, {
        patient_id: user.id,
        event_type: 'INPUT_CONFIRMED',
        actor_type: 'patient',
        actor_id: user.id,
        source_component: 'MedicationAction',
        source_version: '1.0.0',
        metadata: { action: 'confirmPrescriptionCandidate', medication_id: medication.id, display_name: medication.display_name }
      })
    } catch (err) {
      console.error('Failed to record trace event for confirmed candidate:', err)
    }

    // Insert schedules if not PRN and provided
    if (!medicationInput.isPrn && medicationInput.schedules && medicationInput.schedules.length > 0) {
      const schedulesToInsert = medicationInput.schedules.map((s) => ({
        patient_id: user.id,
        patient_medication_id: medication.id,
        time_of_day: s.timeOfDay,
        slot_label: s.slotLabel || 'morning',
        days_of_week: s.daysOfWeek || null,
        dose_quantity: s.doseQuantity || 1.0,
        is_active: true
      }))

      const { data: insertedSchedules, error: schedErr } = await supabase
        .from('medication_schedules')
        .insert(schedulesToInsert)
        .select()

      if (schedErr) {
        console.error('Error creating schedules:', schedErr)
      } else if (insertedSchedules) {
        // Project scheduled doses for the next 14 days
        await projectScheduledDoses(user.id, medication.id, insertedSchedules, 14)
      }
    }
  }

  revalidatePath('/patient/prescriptions')
  revalidatePath('/patient/medications')
  return { success: true, medication, was_created }
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
