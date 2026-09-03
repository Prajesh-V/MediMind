'use client'

import { useState } from 'react'
import { redeemConnectionCode } from '@/app/actions/connection'
import { Button } from '@/components/forms/Button'
import styles from './Connections.module.css'

export function ProfessionalRedemption() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleRedeem = async () => {
    if (!code) return
    setLoading(true)
    setMsg({ text: '', type: '' })

    const res = await redeemConnectionCode(code)
    
    if (res.success) {
      setMsg({ text: 'Code redeemed successfully! Waiting for patient approval.', type: 'success' })
      setCode('')
    } else {
      setMsg({ text: res.error || 'Failed to redeem.', type: 'error' })
    }
    setLoading(false)
  }

  return (
    <div className={styles.connectionsBox}>
      <h4>Connect with a Patient</h4>
      <p className={styles.desc}>Enter the 6-character code provided by your patient.</p>
      
      <div className={styles.inputRow}>
        <input 
          type="text" 
          value={code} 
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="e.g. A1B2C3"
          className={styles.input}
        />
        <Button variant="primary" onClick={handleRedeem} disabled={loading || code.length < 6}>
          {loading ? 'Redeeming...' : 'Redeem Code'}
        </Button>
      </div>
      
      {msg.text && (
        <p className={msg.type === 'success' ? styles.successText : styles.errorText}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
