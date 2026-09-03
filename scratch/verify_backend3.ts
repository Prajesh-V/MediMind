import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runVerification() {
  console.log("=== STARTING BACKEND VERIFICATION ===")
  try {
    const patientId = '00000000-0000-0000-0000-000000000001'
    const profId = '00000000-0000-0000-0000-000000000002'
    await supabase.auth.admin.createUser({ id: patientId, email: 'test_pat@test.com', password: 'password', email_confirm: true, user_metadata: { role: 'patient' } }).catch(() => {})
    await supabase.from('patients').upsert({ id: patientId, first_name: 'Test', last_name: 'Patient' })
    const { data: p } = await supabase.from('prescriptions').insert({ patient_id: patientId, doctor_name: 'Test Doc', title: 'Test Presc' }).select().single()
    const { data: c1 } = await supabase.from('prescription_candidates').insert({ prescription_id: p.id, raw_name: 'Test Drug Accept', status: 'pending' }).select().single()
    const { data: c2 } = await supabase.from('prescription_candidates').insert({ prescription_id: p.id, raw_name: 'Test Drug Reject', status: 'pending' }).select().single()
    console.log('Created candidates:', c1.id, c2.id)
    const { data: authData } = await supabase.auth.signInWithPassword({ email: 'test_pat@test.com', password: 'password' })
    const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: 'Bearer ' + authData.session?.access_token } } })
    const { data: rpcRes, error: rpcErr } = await userClient.rpc('confirm_prescription_candidate_atomic', { p_candidate_id: c1.id, p_medication_payload: { rxcui: '12345', display_name: 'Test Drug Accept', verification_status: 'verified_rxnorm' } })
    if (rpcErr) throw rpcErr
    console.log('Accept RPC succeeded. Result:', rpcRes.medication.display_name)
    const { data: checkMed } = await supabase.from('patient_medications').select('*').eq('id', rpcRes.medication.id).single()
    const { data: checkCand } = await supabase.from('prescription_candidates').select('*').eq('id', c1.id).single()
    console.log('Medication created:', !!checkMed, 'Prescription ID preserved:', checkMed.prescription_id === p.id)
    console.log('Candidate confirmed:', checkCand.status === 'confirmed', 'Linked:', checkCand.confirmed_medication_id === checkMed.id)
    const { error: rejectErr } = await userClient.from('prescription_candidates').update({ status: 'rejected' }).eq('id', c2.id)
    if (rejectErr) throw rejectErr
    const { data: checkCand2 } = await supabase.from('prescription_candidates').select('*').eq('id', c2.id).single()
    console.log('Reject candidate status:', checkCand2.status)
  } catch (err) { console.error('Test failed', err) }
}
runVerification()
