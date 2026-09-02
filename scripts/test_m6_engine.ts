import { evaluatePatientInteractions } from '../src/services/medical/interaction-engine';
import { DatabaseInteractionRule, PatientEvaluationContext } from '../src/services/medical/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

async function runTests() {
  console.log('=== Running Deterministic Medical Interaction Engine Unit Tests ===\n');

  const sampleRuleDDI: DatabaseInteractionRule = {
    id: 'rule-ddi-1',
    rule_key: 'LISINOPRIL_SPIRONOLACTONE_HYPERKALEMIA',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['29046', '9997'],
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
    mechanism: 'Additive potassium-retaining effect leads to severe hyperkalemia risk.',
    effect: 'May cause cardiac arrhythmias, muscle weakness, or cardiac arrest.',
    recommendation_template: 'Monitor serum potassium and renal function closely.',
    effective_from: '2020-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [
      {
        id: 'ev-1',
        citation_text: 'FDA Label Warning on ACE Inhibitors and Aldosterone Antagonists',
        source_url: 'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=example',
        evidence_grade: 'A',
        source_record_id: 'rec-1',
        source_records: {
          source_name: 'dailymed',
          external_identifier: 'FDA-LABEL-29046',
        },
      },
    ],
  };

  const sampleRuleFood: DatabaseInteractionRule = {
    id: 'rule-food-1',
    rule_key: 'ATORVASTATIN_GRAPEFRUIT',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['83367'],
      condition: 'ALL',
    },
    food_component_selector: {
      components: ['grapefruit'],
      condition: 'ANY',
    },
    temporal_logic: {
      type: 'none',
    },
    severity: 'moderate',
    mechanism: 'Grapefruit inhibits CYP3A4 metabolism of atorvastatin.',
    effect: 'Increased risk of myopathy and rhabdomyolysis.',
    recommendation_template: 'Avoid large quantities of grapefruit juice.',
    effective_from: '2020-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [
      {
        id: 'ev-2',
        citation_text: 'openFDA Drug-Food Interaction Notice',
        source_url: 'https://open.fda.gov/drug/event/',
        evidence_grade: 'B',
        source_record_id: 'rec-2',
        source_records: {
          source_name: 'openfda',
          external_identifier: 'FDA-DFI-83367',
        },
      },
    ],
  };

  const sampleRuleTiming: DatabaseInteractionRule = {
    id: 'rule-timing-1',
    rule_key: 'CIPROFLOXACIN_CALCIUM_SEPARATION',
    version: 1,
    status: 'approved',
    medication_selector: {
      type: 'exact_rxcui',
      entities: ['2551', '1908'],
      condition: 'ALL',
    },
    food_component_selector: {
      components: [],
      condition: 'ANY',
    },
    temporal_logic: {
      type: 'separation',
      min_hours_separation: 2,
    },
    severity: 'moderate',
    mechanism: 'Chelation of ciprofloxacin by polyvalent cations.',
    effect: 'Decreased therapeutic efficacy of ciprofloxacin.',
    recommendation_template: 'Administer at least 2 hours apart.',
    effective_from: '2020-01-01T00:00:00Z',
    effective_until: null,
    rule_evidence: [],
  };

  // 1. DDI Exact Match
  const contextDDI: PatientEvaluationContext = {
    patient_id: 'patient-123',
    medications: [
      { id: 'med-1', rxcui: '29046', display_name: 'Lisinopril 10mg', generic_name: 'Lisinopril', food_relation: 'no_relation' },
      { id: 'med-2', rxcui: '9997', display_name: 'Spironolactone 25mg', generic_name: 'Spironolactone', food_relation: 'no_relation' },
    ],
  };
  const res1 = evaluatePatientInteractions(contextDDI, [sampleRuleDDI]);
  assert(res1.length === 1, 'Exact RxCUI DDI matches when both drugs present');
  assert(res1[0].severity === 'high', 'Severity is high as defined in approved rule');
  assert(res1[0].requires_professional_review === true, 'High severity flags professional review required');

  // 2. Partial DDI Non-match
  const contextPartial: PatientEvaluationContext = {
    patient_id: 'patient-123',
    medications: [
      { id: 'med-1', rxcui: '29046', display_name: 'Lisinopril 10mg', generic_name: 'Lisinopril', food_relation: 'no_relation' },
    ],
  };
  const res2 = evaluatePatientInteractions(contextPartial, [sampleRuleDDI]);
  assert(res2.length === 0, 'No match when only 1 of 2 interacting medications is present');

  // 3. Food Interaction Match
  const contextFood: PatientEvaluationContext = {
    patient_id: 'patient-123',
    medications: [
      { id: 'med-statin', rxcui: '83367', display_name: 'Atorvastatin 20mg', generic_name: 'Atorvastatin', food_relation: 'no_relation' },
    ],
    dietary_records: [
      { id: 'food-1', component_name: 'Grapefruit', consumed_at: '2026-09-01T08:00:00Z' },
    ],
  };
  const res3 = evaluatePatientInteractions(contextFood, [sampleRuleFood]);
  assert(res3.length === 1, 'Food interaction matches when confirmed dietary record matches food selector');
  assert(res3[0].interaction_type === 'medication-food', 'Interaction type correctly categorized as medication-food');

  // 4. Timing Separation Rule
  const contextTiming: PatientEvaluationContext = {
    patient_id: 'patient-123',
    medications: [
      {
        id: 'med-cipro',
        rxcui: '2551',
        display_name: 'Ciprofloxacin 500mg',
        generic_name: 'Ciprofloxacin',
        food_relation: 'no_relation',
        schedules: [{ id: 's1', time_of_day: '08:00:00', slot_label: 'morning', dose_quantity: 1 }],
      },
      {
        id: 'med-calcium',
        rxcui: '1908',
        display_name: 'Calcium 500mg',
        generic_name: 'Calcium',
        food_relation: 'no_relation',
        schedules: [{ id: 's2', time_of_day: '09:00:00', slot_label: 'morning', dose_quantity: 1 }],
      },
    ],
  };
  const res4 = evaluatePatientInteractions(contextTiming, [sampleRuleTiming]);
  assert(res4.length === 1, 'Timing interaction matches when schedules violate 2-hour separation');
  assert(res4[0].interaction_type === 'medication-timing', 'Interaction type correctly categorized as medication-timing');

  // 5. Lifecycle Status Isolation
  const inactiveRules: DatabaseInteractionRule[] = [
    { ...sampleRuleDDI, id: 'r-draft', status: 'draft' },
    { ...sampleRuleDDI, id: 'r-submitted', status: 'submitted' },
    { ...sampleRuleDDI, id: 'r-retired', status: 'retired' },
  ];
  const res5 = evaluatePatientInteractions(contextDDI, inactiveRules);
  assert(res5.length === 0, 'Strictly zero matches for draft, submitted, or retired rules');

  // 6. Severity Maximization
  const modRule: DatabaseInteractionRule = {
    ...sampleRuleDDI,
    id: 'r-mod',
    severity: 'moderate',
    rule_evidence: [
      {
        id: 'ev-mod',
        citation_text: 'RxNorm Guideline Citation',
        source_url: 'https://rxnav.nlm.nih.gov',
        evidence_grade: 'B',
        source_record_id: 'rec-mod',
        source_records: { source_name: 'rxnorm', external_identifier: 'RX-29046' },
      },
    ],
  };
  const res6 = evaluatePatientInteractions(contextDDI, [modRule, sampleRuleDDI]);
  assert(res6.length === 1, 'Overlapping rules merged into a single alert');
  assert(res6[0].severity === 'high', 'Severity maximization picks High over Moderate');
  assert(res6[0].evidence_references.length === 2, 'Evidence provenance is accumulated across matching rules');

  console.log('\n✨ ALL DETERMINISTIC INTERACTION ENGINE TESTS PASSED SUCCESFULLY!\n');
}

runTests().catch(console.error);
