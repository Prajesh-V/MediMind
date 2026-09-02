'use server'

import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'

// Helper to securely hash the code
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

// Generate a random 6-character alphanumeric code
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // exclude ambiguous chars like 1, I, O, 0
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function generateConnectionCode() {
  const supabase = await createClient()
  const rawCode = generateRandomCode()
  const codeHash = hashCode(rawCode)

  const { error } = await supabase.rpc('generate_connection_code', {
    p_code_hash: codeHash
  })

  if (error) {
    console.error('Error generating code:', error)
    return { success: false, error: error.message || 'Failed to generate code.' }
  }

  // Raw code is only returned once, never stored
  return { success: true, code: rawCode }
}

export async function redeemConnectionCode(rawCode: string) {
  const supabase = await createClient()
  const codeHash = hashCode(rawCode.toUpperCase())

  const { error } = await supabase.rpc('redeem_connection_code', {
    p_code_hash: codeHash
  })

  if (error) {
    console.error('Error redeeming code:', error)
    return { success: false, error: error.message || 'Invalid or expired code.' }
  }

  revalidatePath('/professional')
  return { success: true }
}

export async function approveConnection(connectionId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('approve_connection', {
    p_connection_id: connectionId
  })

  if (error) {
    console.error('Error approving connection:', error)
    return { success: false, error: 'Failed to approve connection.' }
  }

  revalidatePath('/patient/settings')
  return { success: true }
}

export async function revokeConnection(connectionId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('revoke_connection', {
    p_connection_id: connectionId
  })

  if (error) {
    console.error('Error revoking connection:', error)
    return { success: false, error: 'Failed to revoke connection.' }
  }

  revalidatePath('/patient/settings')
  return { success: true }
}
