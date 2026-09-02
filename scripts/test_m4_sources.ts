import { searchRxNorm, getRxNormProperties } from '../src/services/rxnorm';
import { dailyMedAdapter } from '../src/services/medical/dailymed';
import { openFdaAdapter } from '../src/services/medical/openfda';

async function testSources() {
  console.log('==================================================');
  console.log('1. RxNorm Adapter Test');
  console.log('==================================================');
  
  const rxRes = await searchRxNorm('ibuprofen');
  console.log('RxNorm Lookup Result Count:', rxRes.length);
  if (rxRes.length > 0) {
    const rxProps = await getRxNormProperties(rxRes[0].rxcui);
    console.log('RxNorm Property Retrieval:');
    console.log(JSON.stringify(rxProps, null, 2));
  }

  console.log('\n==================================================');
  console.log('2. DailyMed Adapter Test');
  console.log('==================================================');
  
  const dmRes = await dailyMedAdapter.lookup({ rxcui: rxRes[0]?.rxcui || '5640' });
  console.log('DailyMed Lookup Result:', dmRes ? 'SUCCESS' : 'FAILED');
  if (dmRes && dmRes.data && dmRes.data.length > 0) {
    console.log('DailyMed Lookup Data (first 1):', dmRes.data[0]);
    console.log(`Jurisdiction: ${dmRes.jurisdiction}, Retrieved: ${dmRes.retrievedAt}`);
    
    const dmLabel = await dailyMedAdapter.retrieval(dmRes.data[0].setid);
    console.log('DailyMed Label Retrieval Success:', !!dmLabel);
  }

  console.log('\n==================================================');
  console.log('3. openFDA Adapter Test');
  console.log('==================================================');
  
  const fdaRes = await openFdaAdapter.lookup({ term: 'ibuprofen' });
  console.log('openFDA Lookup Result:', fdaRes ? 'SUCCESS' : 'FAILED');
  if (fdaRes && fdaRes.data && fdaRes.data.length > 0) {
    console.log('openFDA Lookup Data (first 1):', JSON.stringify(fdaRes.data[0]).substring(0, 200) + '...');
    console.log(`Jurisdiction: ${fdaRes.jurisdiction}, Retrieved: ${fdaRes.retrievedAt}`);
    
    const fdaReport = await openFdaAdapter.retrieval(fdaRes.data[0].safetyreportid);
    console.log('openFDA Report Retrieval Success:', !!fdaReport);
  }

  console.log('\n==================================================');
  console.log('4. Failure Path Test (DailyMed bad ID)');
  console.log('==================================================');
  const badDm = await dailyMedAdapter.retrieval('invalid-set-id-9999');
  console.log('Bad DailyMed ID Result (should be null or handle gracefully):', badDm);
}

testSources().catch(console.error);
