import { evaluatePatientInteractions } from '../src/services/medical/interaction-engine';
import { DatabaseInteractionRule, PatientEvaluationContext } from '../src/services/medical/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

async function runM6Verification() {
  console.log('====================================================');
  console.log('  MILESTONE 6: DETERMINISTIC INTERACTION ENGINE E2E ');
  console.log('====================================================\n');

  console.log('--- 1. Testing Drug-Drug Interaction (DDI) Exact RxCUI Matching ---');
  const ddiRule: DatabaseInteractionRule = {
    id: 'ddi-rule-1',
    rule_key: 'WARFARIN_ASPIRIN_BLEEDING',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['11289', '1191'], // Warfarin (11289), Aspirin (1191)
      condition: 'ALL',
    },
    food_component_selector: {
      components: [],
      condition: 'ANY',
    },
    temporal_logic: {
      type: 'none',
    },
    severity: 'high',
    mechanism: 'Combined anticoagulant and antiplatelet effects synergistically impair hemostasis.',
    effect: 'Significantly elevated risk of major gastrointestinal and intracranial hemorrhages.',
    recommendation_template: 'Avoid combination unless specifically indicated. Monitor INR and signs of bleeding.',
    effective_from: '2022-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [
      {
        id: 'ev-1',
        citation_text: 'FDA Package Insert: Warfarin Sodium Tablets',
        source_url: 'https://dailymed.nlm.nih.gov',
        evidence_grade: 'A',
        source_record_id: 'rec-1',
        source_records: {
          source_name: 'dailymed',
          external_identifier: 'FDA-LABEL-11289',
        },
      },
    ],
  };

  const patientWithBoth: PatientEvaluationContext = {
    patient_id: 'patient-test-01',
    medications: [
      { id: 'm1', rxcui: '11289', display_name: 'Warfarin 5mg', generic_name: 'Warfarin', food_relation: 'no_relation' },
      { id: 'm2', rxcui: '1191', display_name: 'Aspirin 81mg', generic_name: 'Aspirin', food_relation: 'no_relation' },
      { id: 'm3', rxcui: '83367', display_name: 'Atorvastatin 20mg', generic_name: 'Atorvastatin', food_relation: 'no_relation' },
    ],
  };

  const ddiRes = evaluatePatientInteractions(patientWithBoth, [ddiRule]);
  assert(ddiRes.length === 1, 'Warfarin + Aspirin DDI identified deterministically');
  assert(ddiRes[0].severity === 'high', 'Severity matches approved rule (High)');
  assert(ddiRes[0].requires_professional_review === true, 'High severity flags professional review required');
  assert(ddiRes[0].evidence_references[0].source === 'dailymed', 'Evidence source is traceable to DailyMed');
  assert(ddiRes[0].evidence_references[0].jurisdiction === 'US-FDA', 'Jurisdiction is explicitly tagged as US-FDA');

  console.log('\n--- 2. Testing Drug-Food Interaction (DFI) Matching ---');
  const dfiRule: DatabaseInteractionRule = {
    id: 'dfi-rule-1',
    rule_key: 'WARFARIN_VITAMIN_K_LEAFY_GREENS',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['11289'], // Warfarin
      condition: 'ALL',
    },
    food_component_selector: {
      components: ['leafy greens', 'spinach', 'kale'],
      condition: 'ANY',
    },
    temporal_logic: {
      type: 'none',
    },
    severity: 'moderate',
    mechanism: 'High dietary vitamin K intake directly antagonizes warfarin inhibition of clotting factors.',
    effect: 'Decreased anticoagulant effect and lower INR, increasing thrombosis risk.',
    recommendation_template: 'Maintain a consistent dietary intake of vitamin K-rich foods.',
    effective_from: '2022-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [
      {
        id: 'ev-2',
        citation_text: 'openFDA Drug-Dietary Reference Table',
        source_url: 'https://open.fda.gov',
        evidence_grade: 'A',
        source_record_id: 'rec-2',
        source_records: {
          source_name: 'openfda',
          external_identifier: 'FDA-DIET-11289',
        },
      },
    ],
  };

  const patientDietaryIntake: PatientEvaluationContext = {
    patient_id: 'patient-test-01',
    medications: [
      { id: 'm1', rxcui: '11289', display_name: 'Warfarin 5mg', generic_name: 'Warfarin', food_relation: 'no_relation' },
    ],
    dietary_records: [
      { id: 'diet-1', component_name: 'Steamed Spinach', consumed_at: new Date().toISOString() },
    ],
  };

  const dfiRes = evaluatePatientInteractions(patientDietaryIntake, [dfiRule]);
  assert(dfiRes.length === 1, 'Warfarin + Spinach DFI identified deterministically from confirmed dietary log');
  assert(dfiRes[0].interaction_type === 'medication-food', 'Interaction type is medication-food');
  assert(dfiRes[0].affected_food_components?.includes('spinach') === true, 'Matching food component tagged as spinach');

  console.log('\n--- 3. Testing Administration Timing (DTI) Logic ---');
  const dtiRule: DatabaseInteractionRule = {
    id: 'dti-rule-1',
    rule_key: 'LEVOTHYROXINE_CALCIUM_TIMING',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['10582', '1908'], // Levothyroxine, Calcium
      condition: 'ALL',
    },
    food_component_selector: {
      components: [],
      condition: 'ANY',
    },
    temporal_logic: {
      type: 'separation',
      min_hours_separation: 4,
    },
    severity: 'moderate',
    mechanism: 'Calcium binds levothyroxine in the GI tract, preventing systemic absorption.',
    effect: 'Sub-therapeutic thyroid hormone levels and recurrence of hypothyroidism symptoms.',
    recommendation_template: 'Separate administration of levothyroxine and calcium supplements by at least 4 hours.',
    effective_from: '2022-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [],
  };

  const patientConflictSchedule: PatientEvaluationContext = {
    patient_id: 'patient-test-01',
    medications: [
      {
        id: 'm-levo',
        rxcui: '10582',
        display_name: 'Levothyroxine 50mcg',
        generic_name: 'Levothyroxine',
        food_relation: 'empty_stomach',
        schedules: [{ id: 's1', time_of_day: '07:00:00', slot_label: 'morning', dose_quantity: 1 }],
      },
      {
        id: 'm-calc',
        rxcui: '1908',
        display_name: 'Calcium 500mg',
        generic_name: 'Calcium',
        food_relation: 'with_meal',
        schedules: [{ id: 's2', time_of_day: '08:00:00', slot_label: 'morning', dose_quantity: 1 }], // 1h apart (violates 4h)
      },
    ],
  };

  const patientSeparatedSchedule: PatientEvaluationContext = {
    patient_id: 'patient-test-01',
    medications: [
      {
        id: 'm-levo',
        rxcui: '10582',
        display_name: 'Levothyroxine 50mcg',
        generic_name: 'Levothyroxine',
        food_relation: 'empty_stomach',
        schedules: [{ id: 's1', time_of_day: '07:00:00', slot_label: 'morning', dose_quantity: 1 }],
      },
      {
        id: 'm-calc',
        rxcui: '1908',
        display_name: 'Calcium 500mg',
        generic_name: 'Calcium',
        food_relation: 'with_meal',
        schedules: [{ id: 's2', time_of_day: '12:00:00', slot_label: 'afternoon', dose_quantity: 1 }], // 5h apart (valid)
      },
    ],
  };

  const dtiViolationRes = evaluatePatientInteractions(patientConflictSchedule, [dtiRule]);
  assert(dtiViolationRes.length === 1, 'Timing conflict flagged when doses are scheduled 1 hour apart (requires 4 hours)');
  assert(dtiViolationRes[0].interaction_type === 'medication-timing', 'Categorized as medication-timing');

  const dtiValidRes = evaluatePatientInteractions(patientSeparatedSchedule, [dtiRule]);
  assert(dtiValidRes.length === 0, 'No timing conflict flagged when doses are separated by 5 hours');

  console.log('\n--- 4. Testing Governance Status Boundary & Inactive Exclusion ---');
  const inactiveStatuses: Array<'draft' | 'submitted' | 'retired'> = ['draft', 'submitted', 'retired'];
  for (const status of inactiveStatuses) {
    const inactiveRule: DatabaseInteractionRule = {
      ...ddiRule,
      id: `rule-${status}`,
      status,
    };
    const res = evaluatePatientInteractions(patientWithBoth, [inactiveRule]);
    assert(res.length === 0, `Rule with status '${status}' produces 0 matches`);
  }

  console.log('\n--- 5. Testing Severity Maximization & Evidence Aggregation ---');
  const ddiMod: DatabaseInteractionRule = {
    ...ddiRule,
    id: 'ddi-mod',
    severity: 'moderate',
    rule_evidence: [
      {
        id: 'ev-rxnorm',
        citation_text: 'RxNorm Drug Interaction Standard',
        source_url: 'https://rxnav.nlm.nih.gov',
        evidence_grade: 'B',
        source_record_id: 'rec-rx',
        source_records: { source_name: 'rxnorm', external_identifier: 'RX-11289' },
      },
    ],
  };

  const combinedRes = evaluatePatientInteractions(patientWithBoth, [ddiMod, ddiRule]);
  assert(combinedRes.length === 1, 'Overlapping rules for the same drug pair are merged into 1 assessment');
  assert(combinedRes[0].severity === 'high', 'Severity Maximization selected High over Moderate');
  assert(combinedRes[0].evidence_references.length === 2, 'Evidence references combined from all matching rules');

  console.log('\n====================================================');
  console.log('  ALL M6 DETERMINISTIC INTERACTION INVARIANTS PASS   ');
  console.log('====================================================\n');
}

runM6Verification().catch(console.error);
