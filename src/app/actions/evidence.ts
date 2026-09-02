'use server'

import { createClient } from '@/utils/supabase/server'
import { searchRxNorm, getRxNormProperties } from '@/services/rxnorm'
import { dailyMedAdapter } from '@/services/medical/dailymed'
import { openFdaAdapter } from '@/services/medical/openfda'

export async function fetchEvidenceFromSource(source: string, identifier: string) {
  const supabase = createClient()
  const { data: { user } } = await (await supabase).auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Enforce reviewer authorization
  const { data: reviewer, error: reviewerErr } = await (await supabase)
    .from('medical_knowledge.authorized_reviewers')
    .select('user_id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .single()

  if (reviewerErr || !reviewer) {
    throw new Error('Forbidden: Must be an active authorized clinical reviewer')
  }

  let result = null

  switch (source) {
    case 'rxnorm':
      result = await getRxNormProperties(identifier)
      // Note: rxnorm.ts currently returns raw data directly via getRxNormProperties,
      // but in our M4 rewrite, we want to capture the SourceResponse if we call the adapter directly.
      break
    case 'dailymed':
      result = await dailyMedAdapter.retrieval(identifier)
      break
    case 'openfda':
      result = await openFdaAdapter.retrieval(identifier)
      break
    default:
      throw new Error(`Unsupported source: ${source}`)
  }

  if (!result) {
    throw new Error('Failed to retrieve evidence from source')
  }

  // Strip massive payload fields if necessary (for example, limiting size to 500kb)
  let payloadStr = JSON.stringify(result)
  if (payloadStr.length > 500000) {
    // Truncate or simplify the raw payload
    result = { ...result, rawPayload: { warning: 'Payload truncated for size limits', snippet: payloadStr.substring(0, 1000) } }
  }

  return result
}
