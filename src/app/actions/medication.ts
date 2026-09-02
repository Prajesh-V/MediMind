'use server'

import { createClient } from '@/utils/supabase/server'
import { searchRxNorm, getRxNormProperties } from '@/services/rxnorm'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { recordTraceEvent } from '@/services/medical/trace'
import { localToUtc } from '@/utils/timezone'
import { triggerAlertReconciliation } from './alerts'

export interface CreateMedicationInput {
  prescription_id?: string
  rxcui?: string
  displayName: string
  genericName?: string
  dosageAmount?: number
  dosageUnit?: string
  dosageForm?: string
  route?: string
  foodRelation?: 'no_relation' | 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach'
  administrationInstructions?: string
  startDate?: string
  endDate?: string
  isPrn?: boolean
  verificationStatus?: 'verified_rxnorm' | 'unverified' | 'manual_custom'
  schedules?: Array<{
    timeOfDay: string // '08:00:00'
    slotLabel: 'morning' | 'afternoon' | 'evening' | 'night' | 'custom'
    daysOfWeek?: number[]
    doseQuantity?: number
  }>
}

export async function searchMedicationConcepts(query: string) {
  return await searchRxNorm(query)
}

import { authorizePatientAccess } from './connection'

/**
 * Retrieves the canonical active medications for a patient, securely authenticated.
 * Used by UI dashboards, interaction engine, and workspace.
 */
export async function getPatientActiveMedications(patientId?: string) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Unauthorized')
  
  const targetPatientId = patientId || user.id
  await authorizePatientAccess(targetPatientId)

  const { data, error } = await supabase
    .from('patient_medications')
    .select(`
      *,
      medication_schedules (*)
    `)
    .eq('patient_id', patientId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching patient medications:', error)
    throw new Error('Failed to load active medications')
  }

  return data || []
}

export async function createMedication(input: CreateMedicationInput) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 1. Determine verification status if rxcui is provided
  let verificationStatus = input.verificationStatus || 'unverified'
  let normalizedName = input.displayName

  if (input.rxcui) {
    const props = await getRxNormProperties(input.rxcui)
    if (props) {
      verificationStatus = 'verified_rxnorm'
      if (!input.genericName && props.name) {
        input.genericName = props.name
      }
    }
  }

  // 2. Insert into patient_medications
  const { data: med, error: medErr } = await supabase
    .from('patient_medications')
    .insert({
      patient_id: user.id,
      prescription_id: input.prescription_id || null,
      rxcui: input.rxcui || null,
      display_name: normalizedName,
      generic_name: input.genericName || null,
      dosage_amount: input.dosageAmount || null,
      dosage_unit: input.dosageUnit || null,
      dosage_form: input.dosageForm || null,
      route: input.route || 'oral',
      food_relation: input.foodRelation || 'no_relation',
      administration_instructions: input.administrationInstructions || null,
      start_date: input.startDate || new Date().toISOString().split('T')[0],
      end_date: input.endDate || null,
      is_prn: input.isPrn ?? false,
      is_active: true,
      verification_status: verificationStatus
    })
    .select()
    .single()

  if (medErr || !med) {
    console.error('Error inserting medication:', medErr)
    return { success: false, error: medErr?.message || 'Failed to create medication.' }
  }

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
      metadata: { action: 'createMedication', medication_id: med.id, display_name: med.display_name }
    })
  } catch (err) {
    console.error('Failed to record trace event for medication creation:', err)
  }

  // 3. Insert schedules if not PRN and provided
  if (!input.isPrn && input.schedules && input.schedules.length > 0) {
    const schedulesToInsert = input.schedules.map((s) => ({
      patient_id: user.id,
      patient_medication_id: med.id,
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
      // 4. Project scheduled doses for the next 14 days
      await projectScheduledDoses(user.id, med.id, insertedSchedules, 14)
    }
  }

  try {
    await triggerAlertReconciliation(user.id);
  } catch (err) {
    console.error('Alert reconciliation failed during medication creation:', err);
  }

  revalidatePath('/patient')
  revalidatePath('/patient/medications')
  return { success: true, medication: med }
}

export async function archiveMedication(medicationId: string) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('patient_medications')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', medicationId)
    .eq('patient_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Also cancel future pending scheduled doses
  await supabase
    .from('scheduled_doses')
    .delete()
    .eq('patient_medication_id', medicationId)
    .eq('status', 'pending')
    .gt('scheduled_time', new Date().toISOString())

  try {
    await triggerAlertReconciliation(user.id);
  } catch (err) {
    console.error('Alert reconciliation failed during medication archive:', err);
  }

  revalidatePath('/patient')
  revalidatePath('/patient/medications')
  return { success: true }
}

/**
 * Projects scheduled_doses for the specified days ahead.
 */
export async function projectScheduledDoses(
  patientId: string,
  medicationId: string,
  schedules: any[],
  daysAhead: number = 14
) {
  const supabase = await createClient()
  
  // Get patient timezone
  const { data: patient } = await supabase
    .from('patients')
    .select('timezone')
    .eq('id', patientId)
    .single()

  const timezone = patient?.timezone || 'UTC'
  const dosesToInsert: any[] = []
  const today = new Date()

  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + i)
    const dayOfWeek = targetDate.getDay() // 0 = Sun, 6 = Sat
    const dateStr = targetDate.toISOString().split('T')[0]

    for (const s of schedules) {
      // Check if schedule runs on this day of week
      if (Array.isArray(s.days_of_week) && s.days_of_week.length > 0) {
        if (!s.days_of_week.includes(dayOfWeek)) continue
      }

      // Compute UTC timestamp for local date + time_of_day in patient's timezone
      const timeStr = s.time_of_day // e.g. "08:00:00"
      
      // Convert to UTC ISO string safely using the patient's timezone
      const scheduledUtc = localToUtc(dateStr, timeStr, timezone)

      dosesToInsert.push({
        patient_id: patientId,
        patient_medication_id: medicationId,
        schedule_id: s.id,
        scheduled_time: scheduledUtc,
        status: 'pending'
      })
    }
  }

  if (dosesToInsert.length > 0) {
    await supabase
      .from('scheduled_doses')
      .upsert(dosesToInsert, { onConflict: 'schedule_id,scheduled_time', ignoreDuplicates: true })
  }
}
