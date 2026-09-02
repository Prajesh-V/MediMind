import { searchMedicationConcepts } from '../src/app/actions/medication';

async function main() {
  console.log('Testing search for amlo...');
  const res = await searchMedicationConcepts('amlo');
  console.log('Results count:', res.length);
  console.log('Results sample:', res.slice(0, 3));
}

main().catch(console.error);
