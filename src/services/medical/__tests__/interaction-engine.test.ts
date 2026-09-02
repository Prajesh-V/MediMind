import assert from 'node:assert';
import { evaluatePatientInteractions } from '../interaction-engine';
import { DatabaseInteractionRule, PatientEvaluationContext } from '../types';

export function runTestSuite() {
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

  const context: PatientEvaluationContext = {
    patient_id: 'patient-123',
    medications: [
      { id: 'med-1', rxcui: '29046', display_name: 'Lisinopril 10mg', generic_name: 'Lisinopril', food_relation: 'no_relation' },
      { id: 'med-2', rxcui: '9997', display_name: 'Spironolactone 25mg', generic_name: 'Spironolactone', food_relation: 'no_relation' },
    ],
  };

  const results = evaluatePatientInteractions(context, [sampleRuleDDI]);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].severity, 'high');
  assert.strictEqual(results[0].requires_professional_review, true);
}
