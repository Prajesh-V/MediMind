import { searchRxNorm, getRxNormProperties } from '../src/services/rxnorm'

async function runTests() {
  console.log('=== 1. RxNorm Live Integration Tests ===')
  
  // Test 1: Exact Match
  console.log('[Test 1.1] Querying "Amlodipine"...')
  const amlodipine = await searchRxNorm('Amlodipine')
  console.log(`Found ${amlodipine.length} candidates. Top:`, amlodipine[0])

  // Test 2: Typo Tolerance
  console.log('\n[Test 1.2] Querying typo "amoxcillin 500"...')
  const amoxicillin = await searchRxNorm('amoxcillin 500')
  console.log(`Found ${amoxicillin.length} candidates. Top:`, amoxicillin[0])

  // Test 3: Unmatched Concept
  console.log('\n[Test 1.3] Querying invalid substance "NonExistentDrug12345"...')
  const unmatched = await searchRxNorm('NonExistentDrug12345')
  console.log(`Found ${unmatched.length} candidates (Expected 0)`)

  // Test 4: RxCUI Property Fetch
  if (amlodipine.length > 0 && amlodipine[0].rxcui) {
    console.log(`\n[Test 1.4] Fetching concept properties for RxCUI ${amlodipine[0].rxcui}...`)
    const props = await getRxNormProperties(amlodipine[0].rxcui)
    console.log('Properties:', props)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
