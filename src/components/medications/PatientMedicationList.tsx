'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { archiveMedication } from '@/app/actions/medication'
import { Button } from '@/components/forms/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './Medications.module.css'

interface MedicationItem {
  id: string
  display_name: string
  generic_name: string | null
  dosage_amount: number | null
  dosage_unit: string | null
  dosage_form: string | null
  food_relation: string
  administration_instructions: string | null
  verification_status: string
  is_prn: boolean
  medication_schedules: Array<{
    time_of_day: string
    slot_label: string
    dose_quantity: number
  }>
}

interface PatientMedicationListProps {
  onCountChange?: (count: number) => void
  refreshTrigger?: number
}

export function PatientMedicationList({ onCountChange, refreshTrigger }: PatientMedicationListProps) {
  const [medications, setMedications] = useState<MedicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchMedications = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('patient_medications')
      .select(`
        id,
        display_name,
        generic_name,
        dosage_amount,
        dosage_unit,
        dosage_form,
        food_relation,
        administration_instructions,
        verification_status,
        is_prn,
        medication_schedules(time_of_day, slot_label, dose_quantity)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setMedications(data as unknown as MedicationItem[])
      onCountChange?.(data.length)
    }
    setLoading(false)
  }, [supabase, onCountChange])

  useEffect(() => {
    fetchMedications()
  }, [fetchMedications, refreshTrigger])

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to stop/archive this medication?')) return
    await archiveMedication(id)
    fetchMedications()
  }

  if (loading) {
    return <p className={styles.hint}>Loading medications...</p>
  }

  if (medications.length === 0) {
    return <EmptyState icon="💊" message="No active medications. Click 'Add Medication' to record your first medication." />
  }

  return (
    <div className={styles.medList}>
      {medications.map((m) => {
        const foodLabel = {
          with_meal: 'With Meal',
          before_meal: 'Before Meal',
          after_meal: 'After Meal',
          empty_stomach: 'Empty Stomach',
          no_relation: 'No Food Restrictions'
        }[m.food_relation] || m.food_relation

        return (
          <div key={m.id} className={styles.medCard}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '16px' }}>{m.display_name}</strong>
                {m.dosage_amount && (
                  <span style={{ color: 'var(--mm-text-muted)', fontSize: '14px' }}>
                    {m.dosage_amount} {m.dosage_unit}
                  </span>
                )}
                {m.dosage_form && (
                  <span style={{ color: 'var(--mm-text-muted)', fontSize: '13px' }}>
                    ({m.dosage_form})
                  </span>
                )}
              </div>

              {m.generic_name && m.generic_name !== m.display_name && (
                <div style={{ fontSize: '13px', color: 'var(--mm-text-secondary)', marginTop: '2px' }}>
                  Generic: {m.generic_name}
                </div>
              )}

              <div className={styles.medMeta}>
                {m.verification_status === 'verified_rxnorm' ? (
                  <span className={`${styles.tag} ${styles.tagVerified}`}>✓ RxNorm Verified</span>
                ) : (
                  <span className={styles.tag}>Custom Item</span>
                )}
                <span className={`${styles.tag} ${styles.tagFood}`}>🥗 {foodLabel}</span>
                {m.is_prn ? (
                  <span className={styles.tag}>As Needed (PRN)</span>
                ) : (
                  m.medication_schedules?.map((s, idx) => (
                    <span key={idx} className={styles.tag}>
                      ⏰ {s.slot_label.toUpperCase()} ({s.time_of_day.slice(0, 5)})
                    </span>
                  ))
                )}
              </div>

              {m.administration_instructions && (
                <p style={{ fontSize: '12px', color: 'var(--mm-text-muted)', margin: '6px 0 0 0' }}>
                  ℹ️ {m.administration_instructions}
                </p>
              )}
            </div>

            <Button
              variant="danger"
              onClick={() => handleArchive(m.id)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
            >
              Stop / Archive
            </Button>
          </div>
        )
      })}
    </div>
  )
}
