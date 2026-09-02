'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTodayDoses, logDoseEvent } from '@/app/actions/dose'
import { Button } from '@/components/forms/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './Medications.module.css'

interface DoseTimelineProps {
  onAdherenceUpdate?: () => void
}

export function DoseTimeline({ onAdherenceUpdate }: DoseTimelineProps) {
  const [doses, setDoses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingId, setLoggingId] = useState<string | null>(null)

  const fetchDoses = useCallback(async () => {
    setLoading(true)
    const data = await getTodayDoses()
    setDoses(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDoses()
  }, [fetchDoses])

  const handleTakeDose = async (dose: any) => {
    setLoggingId(dose.id)
    const res = await logDoseEvent({
      patientMedicationId: dose.patient_medications.id,
      scheduledDoseId: dose.id,
      status: 'taken',
      takenAt: new Date().toISOString()
    })

    if (res.success) {
      await fetchDoses()
      onAdherenceUpdate?.()
    } else {
      alert(res.error || 'Failed to log dose.')
    }
    setLoggingId(null)
  }

  const handleSkipDose = async (dose: any) => {
    setLoggingId(dose.id)
    const res = await logDoseEvent({
      patientMedicationId: dose.patient_medications.id,
      scheduledDoseId: dose.id,
      status: 'skipped',
      takenAt: new Date().toISOString(),
      notes: 'Skipped by patient'
    })

    if (res.success) {
      await fetchDoses()
      onAdherenceUpdate?.()
    }
    setLoggingId(null)
  }

  if (loading) {
    return <p className={styles.hint}>Loading today&apos;s schedule...</p>
  }

  if (doses.length === 0) {
    return <EmptyState icon="📅" message="No doses scheduled for today." />
  }

  return (
    <div className={styles.medList}>
      {doses.map((d) => {
        const med = d.patient_medications
        const sched = d.medication_schedules
        const timeFormatted = new Date(d.scheduled_time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
        const isTaken = d.status === 'taken' || d.status === 'late'
        const isSkipped = d.status === 'skipped'

        return (
          <div key={d.id} className={styles.medCard} style={{ opacity: isTaken || isSkipped ? 0.7 : 1 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{isTaken ? '✅' : isSkipped ? '⏭️' : '⏰'}</span>
                <strong style={{ fontSize: '15px' }}>{timeFormatted}</strong>
                <span>—</span>
                <strong style={{ fontSize: '15px', color: 'var(--mm-primary)' }}>{med?.display_name}</strong>
                {med?.dosage_amount && (
                  <span style={{ fontSize: '13px', color: 'var(--mm-text-muted)' }}>
                    ({med.dosage_amount} {med.dosage_unit})
                  </span>
                )}
              </div>

              <div className={styles.medMeta}>
                <span className={styles.tag}>{sched?.slot_label?.toUpperCase()}</span>
                {med?.food_relation && (
                  <span className={`${styles.tag} ${styles.tagFood}`}>
                    🥗 {med.food_relation.replace('_', ' ')}
                  </span>
                )}
                {isTaken && <span className={`${styles.tag} ${styles.tagVerified}`}>TAKEN</span>}
                {isSkipped && <span className={styles.tag}>SKIPPED</span>}
              </div>
            </div>

            {!isTaken && !isSkipped && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button
                  variant="primary"
                  onClick={() => handleTakeDose(d)}
                  disabled={loggingId === d.id}
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}
                >
                  {loggingId === d.id ? 'Logging...' : 'Take Dose'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSkipDose(d)}
                  disabled={loggingId === d.id}
                  style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                >
                  Skip
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
