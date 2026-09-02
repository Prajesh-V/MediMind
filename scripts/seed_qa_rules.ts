import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Seeding approved QA interaction rules into medical_knowledge...');

  // 1. Get an admin user ID for 'approved_by'
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;
  const adminId = users.users[0]?.id;

  const rules = [
    {
      rule_key: 'ATORVASTATIN_GRAPEFRUIT',
      version: 1,
      status: 'approved',
      medication_selector: {
        type: 'exact_rxcui',
        entities: ['83367'],
        condition: 'ALL'
      },
      food_component_selector: {
        components: ['grapefruit'],
        condition: 'ANY'
      },
      temporal_logic: { type: 'none' },
      severity: 'moderate',
      mechanism: 'Grapefruit inhibits CYP3A4 metabolism of atorvastatin.',
      effect: 'Increased risk of myopathy and rhabdomyolysis.',
      recommendation_template: 'Avoid large quantities of grapefruit juice.',
      effective_from: new Date().toISOString(),
      approved_by: adminId,
      approved_at: new Date().toISOString()
    },
    {
      rule_key: 'LISINOPRIL_SPIRONOLACTONE_HYPERKALEMIA',
      version: 1,
      status: 'approved',
      medication_selector: {
        type: 'exact_rxcui',
        entities: ['29046', '9997'],
        condition: 'ALL'
      },
      food_component_selector: {
        components: [],
        condition: 'ANY'
      },
      temporal_logic: { type: 'none' },
      severity: 'high',
      mechanism: 'Additive potassium-retaining effect leads to severe hyperkalemia risk.',
      effect: 'May cause cardiac arrhythmias, muscle weakness, or cardiac arrest.',
      recommendation_template: 'Monitor serum potassium and renal function closely.',
      effective_from: new Date().toISOString(),
      approved_by: adminId,
      approved_at: new Date().toISOString()
    }
  ];

  for (const rule of rules) {
    // Upsert or insert (ignoring duplicates)
    const { error } = await supabase
      .schema('medical_knowledge')
      .from('interaction_rules')
      .insert(rule);
    
    if (error && !error.message.includes('duplicate key')) {
      console.error(`Error inserting rule ${rule.rule_key}:`, error);
    } else {
      console.log(`Successfully seeded QA rule: ${rule.rule_key}`);
    }
  }

  console.log('QA rules seeding complete!');
}

run().catch(console.error);
