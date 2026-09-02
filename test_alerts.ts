import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: 'C:/dev/MediMind/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function runTests() {
  console.log('--- STARTING ALERTS TEST MATRIX ---')
  const { data: users } = await supabase.auth.admin.listUsers()
  const patientA = users?.users.find(u => u.email === 'patient_a@test.local')
  const patientB = users?.users.find(u => u.email === 'patient_b@test.local')
  
  if (!patientA || !patientB) throw new Error('Test patients not found')
  const pAId = patientA.id

  // Create client logged in as patient_a
  const clientA = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await clientA.auth.signInWithPassword({ email: 'patient_a@test.local', password: 'Password123!' })

  // Clean slate
  await supabase.from('system_alerts').delete().eq('patient_id', pAId)
  
  // Test 1: OCC Concurrency / Stale Generation Rejection
  console.log('\nTEST 1: OCC Concurrency & Stale Rejection')
  
  // Get current generation
  const { data: pat } = await supabase.from('patients').select('alert_generation').eq('id', pAId).single()
  const gen1 = pat!.alert_generation

  const alert1 = {
    patient_id: pAId,
    audience: 'PATIENT',
    source_type: 'M6_INTERACTION',
    source_id: 'm6_123',
    status: 'ACTIVE',
    priority: 'HIGH',
    snapshot: { title: 'Test Alert 1' }
  }

  // Promise 1 should succeed
  const res1 = await supabase.rpc('commit_patient_alerts', {
    p_patient_id: pAId,
    p_expected_generation: gen1,
    p_alerts_payload: [alert1]
  })
  console.log('Commit 1 result (Expected success):', res1.error ? `FAIL: ${res1.error.message}` : 'SUCCESS')

  // Promise 2 should fail with stale generation
  const res2 = await supabase.rpc('commit_patient_alerts', {
    p_patient_id: pAId,
    p_expected_generation: gen1,
    p_alerts_payload: [alert1]
  })
  console.log('Commit 2 result (Expected stale rejection):', res2.error?.message || 'SUCCESS (BAD)')

  // Test 2: M6 fingerprint update preserving read_at
  console.log('\nTEST 2: Update preserving read_at')
  
  // Get current generation
  const { data: pat2 } = await supabase.from('patients').select('alert_generation').eq('id', pAId).single()
  
  // Get alert id
  const { data: alertsDB } = await supabase.from('system_alerts').select('*').eq('patient_id', pAId).eq('source_id', 'm6_123')
  if (!alertsDB || alertsDB.length === 0) {
    console.log('FAIL: Could not find created alert in DB')
    return
  }
  const aId = alertsDB[0].id

  // Patient marks read
  const { error: markErr } = await clientA.rpc('mark_alert_read', { p_alert_id: aId })
  console.log('Mark Read (Expected success):', markErr ? `FAIL: ${markErr.message}` : 'SUCCESS')

  // Update M6 snapshot
  const alert1Updated = {
    ...alert1,
    snapshot: { title: 'Test Alert 1 - UPDATED' }
  }
  const res3 = await supabase.rpc('commit_patient_alerts', {
    p_patient_id: pAId,
    p_expected_generation: pat2!.alert_generation,
    p_alerts_payload: [alert1Updated]
  })
  console.log('Commit 3 result (Expected success):', res3.error ? `FAIL: ${res3.error.message}` : 'SUCCESS')

  const { data: checkRead } = await supabase.from('system_alerts').select('read_at, snapshot').eq('id', aId).single()
  console.log('Preserved read_at?', !!checkRead?.read_at)
  console.log('Updated snapshot?', checkRead?.snapshot.title === 'Test Alert 1 - UPDATED')

  // Test 3: RESOLVED_AUTO mutation rejection
  console.log('\nTEST 3: RLS / Mutation Rejection')
  
  // Try to update it directly via client
  const { data: updData, error: updErr } = await clientA.from('system_alerts').update({ status: 'RESOLVED_AUTO' }).eq('id', aId).select()
  console.log('Client Update (Expected failure):', (updErr || (updData && updData.length > 0)) ? 'SUCCESS (BAD)' : 'SUCCESS (Blocked)')

  // Try to use acknowledge_alert
  const { error: ackErr } = await clientA.rpc('acknowledge_alert', { p_alert_id: aId })
  console.log('Acknowledge via RPC (Expected success):', ackErr ? `FAIL: ${ackErr.message}` : 'SUCCESS')

  // Test 4: Cross-patient RPC rejection
  console.log('\nTEST 4: Cross-patient RPC Rejection')
  
  const clientB = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await clientB.auth.signInWithPassword({ email: 'patient_b@test.local', password: 'Password123!' })

  const { error: crossErr } = await clientB.rpc('mark_alert_read', { p_alert_id: aId })
  console.log('Cross-patient mark_read (Expected failure):', crossErr ? 'SUCCESS (Blocked)' : 'FAIL (Allowed)')

  console.log('\nTests completed.')
}

runTests().catch(console.error)
