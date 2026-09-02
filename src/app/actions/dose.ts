'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LogDoseInput {
  patientMedicationId: string
  scheduledDoseId?: string
  status?: 'taken' | 'late' | 'skipped'
  takenAt?: string
  doseQuantity?: number
  notes?: string
}

export async function logDoseEvent(input: LogDoseInput) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const takenTime = input.takenAt || new Date().toISOString()
  let doseStatus: 'taken' | 'late' | 'skipped' = input.status || 'taken'

  // If tied to a scheduled dose, check time window to classify taken vs late
  if (input.scheduledDoseId && doseStatus !== 'skipped') {
    const { data: scheduled } = await supabase
      .from('scheduled_doses')
      .select('scheduled_time')
      .eq('id', input.scheduledDoseId)
      .single()

    if (scheduled) {
      const scheduledTimeMs = new Date(scheduled.scheduled_time).getTime()
      const takenTimeMs = new Date(takenTime).getTime()
      const diffMinutes = Math.abs(takenTimeMs - scheduledTimeMs) / (1000 * 60)

      if (diffMinutes > 60) {
        doseStatus = 'late'
      }
    }
  }

  // 1. Insert into dose_events
  const { data: doseEvent, error: eventErr } = await supabase
    .from('dose_events')
    .insert({
      patient_id: user.id,
      patient_medication_id: input.patientMedicationId,
      scheduled_dose_id: input.scheduledDoseId || null,
      status: doseStatus,
      taken_at: takenTime,
      dose_quantity: input.doseQuantity || 1.0,
      notes: input.notes || null
    })
    .select()
    .single()

  if (eventErr) {
    return { success: false, error: eventErr.message }
  }

  // 2. If linked to a scheduled dose, update scheduled_doses row status
  if (input.scheduledDoseId) {
    await supabase
      .from('scheduled_doses')
      .update({ status: doseStatus })
      .eq('id', input.scheduledDoseId)
      .eq('patient_id', user.id)
  }

  revalidatePath('/patient')
  revalidatePath('/patient/medications')
  return { success: true, doseEvent }
}

export async function getTodayDoses(patientId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const targetPatientId = patientId || user.id
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const { data, error } = await supabase
    .from('scheduled_doses')
    .select(`
      id,
      scheduled_time,
      status,
      medication_schedules(slot_label, dose_quantity, time_of_day),
      patient_medications(id, display_name, generic_name, dosage_amount, dosage_unit, food_relation, route)
    `)
    .eq('patient_id', targetPatientId)
    .gte('scheduled_time', startOfDay)
    .lte('scheduled_time', endOfDay)
    .order('scheduled_time', { ascending: true })

  if (error) {
    console.error('Error fetching today doses:', error)
    return []
  }

  return data || []
}

export async function getAdherenceMetrics(patientId?: string, windowDays: number = 30) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rate: 0, total: 0, taken: 0, missed: 0, late: 0 }

  const targetPatientId = patientId || user.id
  const now = new Date()
  const pastDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: scheduled } = await supabase
    .from('scheduled_doses')
    .select('id, status, scheduled_time')
    .eq('patient_id', targetPatientId)
    .gte('scheduled_time', pastDate)
    .lte('scheduled_time', now.toISOString())

  if (!scheduled || scheduled.length === 0) {
    return { rate: 100, total: 0, taken: 0, missed: 0, late: 0 }
  }

  const total = scheduled.length
  const taken = scheduled.filter((d) => d.status === 'taken').length
  const late = scheduled.filter((d) => d.status === 'late').length
  const missed = scheduled.filter((d) => d.status === 'pending' || d.status === 'missed').length
  const rate = Math.round(((taken + late) / total) * 100)

  return { rate, total, taken, late, missed }
}
