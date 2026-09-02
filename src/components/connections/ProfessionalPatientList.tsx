'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { EmptyState } from '@/components/feedback/EmptyState'
import styles from './Connections.module.css'

interface PatientConnection {
  id: string
  status: string
  created_at: string
  patients: {
    id: string
    first_name: string
    last_name: string
  } | null
}

interface ProfessionalPatientListProps {
  onCountChange?: (count: number) => void
}

export function ProfessionalPatientList({ onCountChange }: ProfessionalPatientListProps) {
  const [connections, setConnections] = useState<PatientConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null)
  const [patientMeds, setPatientMeds] = useState<any[]>([])
  const [loadingMeds, setLoadingMeds] = useState(false)
  const supabase = createClient()

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('patient_professional_connections')
      .select('id, status, created_at, patients(id, first_name, last_name)')
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setConnections(data as unknown as PatientConnection[])
      const activeCount = data.filter((c: any) => c.status === 'active').length
      onCountChange?.(activeCount)
    }
    setLoading(false)
  }, [supabase, onCountChange])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  const handleToggleExpand = async (patientId: string) => {
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null)
      return
    }

    setExpandedPatientId(patientId)
    setLoadingMeds(true)

    const { data, error } = await supabase
      .from('patient_medications')
      .select(`
        id,
        display_name,
        dosage_amount,
        dosage_unit,
        dosage_form,
        food_relation,
        administration_instructions,
        verification_status,
        medication_schedules(time_of_day, slot_label)
      `)
      .eq('patient_id', patientId)
      .eq('is_active', true)

    if (!error && data) {
      setPatientMeds(data)
    } else {
      setPatientMeds([])
    }
    setLoadingMeds(false)
  }

  if (loading) {
    return <p className={styles.empty}>Loading connected patients...</p>
  }

  if (connections.length === 0) {
    return <EmptyState icon="👥" message="No patients connected yet. Enter a patient's connection code above to connect." />
  }

  return (
    <div className={styles.list}>
      {connections.map((c) => {
        const patientName = c.patients 
          ? `${c.patients.first_name} ${c.patients.last_name}`.trim()
          : 'Pending Patient Approval'
        const isExpanded = c.patients && expandedPatientId === c.patients.id
        
        return (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className={styles.connectionItem}>
              <div>
                <strong>{patientName}</strong>
                <span className={`${styles.badge} ${c.status === 'active' ? styles.badgeActive : styles.badgePending}`}>
                  {c.status.toUpperCase()}
                </span>
                <div className={styles.desc}>
                  Connected on {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>

              {c.status === 'active' && c.patients && (
                <button
                  type="button"
                  onClick={() => handleToggleExpand(c.patients!.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--mm-radius-sm)',
                    border: '1px solid var(--mm-border-input)',
                    background: 'var(--mm-bg-hover)',
                    color: 'var(--mm-text-primary)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {isExpanded ? 'Hide Details' : 'View Regimen'}
                </button>
              )}
            </div>

            {/* Expanded Medication Regimen */}
            {isExpanded && (
              <div style={{
                background: 'var(--mm-bg-hover)',
                padding: '14px',
                borderRadius: 'var(--mm-radius-sm)',
                border: '1px solid var(--mm-border-divider)',
                marginLeft: '12px'
              }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>Active Medication Regimen:</h5>
                {loadingMeds ? (
                  <p style={{ fontSize: '12px', color: 'var(--mm-text-muted)', margin: 0 }}>Loading patient medications...</p>
                ) : patientMeds.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--mm-text-muted)', margin: 0 }}>Patient has no active medications recorded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {patientMeds.map((m) => (
                      <div key={m.id} style={{
                        background: 'var(--mm-bg-card)',
                        padding: '10px 12px',
                        borderRadius: 'var(--mm-radius-sm)',
                        fontSize: '13px'
                      }}>
                        <div style={{ fontWeight: 'bold' }}>
                          💊 {m.display_name} {m.dosage_amount && `(${m.dosage_amount} ${m.dosage_unit})`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--mm-text-muted)', marginTop: '2px' }}>
                          Food: {m.food_relation?.replace('_', ' ')} | Status: {m.verification_status}
                        </div>
                        {m.administration_instructions && (
                          <div style={{ fontSize: '11px', color: 'var(--mm-text-secondary)', marginTop: '2px' }}>
                            Instructions: {m.administration_instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
