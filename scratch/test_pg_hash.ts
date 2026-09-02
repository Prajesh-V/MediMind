import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const str = '0000000000000000000000000000000000000000000000000000000000000000|11111111-1111-1111-1111-111111111111||PATIENT_OBSERVATION_REPORTED|2026-09-03T12:00:00.000Z|patient|11111111-1111-1111-1111-111111111111|SymptomReportForm|1.0.0|{"severity":mild,"symptom":Headache with "quotes","symptom_report_id":22222222-2222-2222-2222-222222222222}';

  const { data, error } = await serviceClient.rpc('execute_sql', {
    sql: `SELECT encode(digest('${str.replace(/'/g, "''")}', 'sha256'), 'hex') as hash;`
  });
  console.log(data, error);
}

run();
