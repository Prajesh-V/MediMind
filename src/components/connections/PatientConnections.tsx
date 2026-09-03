'use client'

import { useState, useEffect, useCallback } from 'react'
import { generateConnectionCode, approveConnection, revokeConnection } from '@/app/actions/connection'
import { Button } from '@/components/forms/Button'
import { createClient } from '@/utils/supabase/client'
import styles from './Connections.module.css'

export function PatientConnections() {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connections, setConnections] = useState<any[]>([])
  
  const supabase = createClient()

  const fetchConnections = useCallback(async () => {
    const { data } = await supabase
      .from('patient_professional_connections')
      .select('id, status, professionals(first_name, last_name, credentials)')
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    if (data) {
      setConnections(data)
    }
  }, [supabase])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleGenerate = async () => {
    setLoading(true)
    setCode(null)
    const res = await generateConnectionCode()
    if (res.success && res.code) {
      setCode(res.code)
    } else {
      alert(res.error)
    }
    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    const res = await approveConnection(id)
    if (res.success) fetchConnections()
    else alert(res.error)
  }

  const handleRevoke = async (id: string) => {
    const res = await revokeConnection(id)
    if (res.success) fetchConnections()
    else alert(res.error)
  }

  return (
    <div className={styles.connectionsBox}>
      <div className={styles.header}>
        <div>
          <h4>Healthcare Professionals</h4>
          <p className={styles.desc}>Manage who has access to your medical data.</p>
        </div>
        <Button variant="secondary" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Code'}
        </Button>
      </div>

      {code && (
        <div className={styles.codeDisplay}>
          <p>Give this code to your doctor. It expires in 15 minutes.</p>
          <h2>{code}</h2>
        </div>
      )}

      {connections.length > 0 ? (
        <div className={styles.list}>
          {connections.map((c) => (
            <div key={c.id} className={styles.connectionItem}>
              <div>
                <strong>{c.professionals?.first_name} {c.professionals?.last_name}, {c.professionals?.credentials}</strong>
                <span className={`${styles.badge} ${c.status === 'active' ? styles.badgeActive : styles.badgePending}`}>
                  {c.status.toUpperCase()}
                </span>
              </div>
              <div className={styles.actions}>
                {c.status === 'pending' && (
                  <Button variant="primary" onClick={() => handleApprove(c.id)}>
                    Approve
                  </Button>
                )}
                <Button variant="danger" onClick={() => handleRevoke(c.id)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No connected professionals.</p>
      )}
    </div>
  )
}
