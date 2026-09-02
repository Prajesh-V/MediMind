'use server'

import { createClient } from '@/utils/supabase/server'

export async function submitRule(ruleId: string) {
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await (await supabase).rpc('submit_interaction_rule', {
    p_rule_id: ruleId
  })

  if (error) throw error
}

export async function approveRule(ruleId: string) {
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Check reviewer status
  const { data: reviewer, error: reviewerErr } = await (await supabase)
    .from('medical_knowledge.authorized_reviewers')
    .select('user_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .single()

  if (reviewerErr || !reviewer) {
    throw new Error('Forbidden: Must be an active authorized clinical reviewer')
  }

  const { error } = await (await supabase).rpc('approve_interaction_rule', {
    p_rule_id: ruleId,
    p_reviewer_credential: 'System-verified'
  })

  if (error) throw error
}

export async function rejectRule(ruleId: string, reason: string) {
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Check reviewer status
  const { data: reviewer, error: reviewerErr } = await (await supabase)
    .from('medical_knowledge.authorized_reviewers')
    .select('user_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .single()

  if (reviewerErr || !reviewer) {
    throw new Error('Forbidden: Must be an active authorized clinical reviewer')
  }

  const { error } = await (await supabase).rpc('reject_interaction_rule', {
    p_rule_id: ruleId,
    p_reason: reason,
    p_reviewer_credential: 'System-verified'
  })

  if (error) throw error
}

export async function retireRule(ruleId: string, reason: string) {
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: reviewer, error: reviewerErr } = await (await supabase)
    .from('medical_knowledge.authorized_reviewers')
    .select('user_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .single()

  if (reviewerErr || !reviewer) {
    throw new Error('Forbidden: Must be an active authorized clinical reviewer')
  }

  const { error } = await (await supabase).rpc('retire_interaction_rule', {
    p_rule_id: ruleId,
    p_reason: reason
  })

  if (error) throw error
}
