# M5: Assessment Schema

## 1. Goal
Design a structured interaction assessment containing the results of the deterministic rule matching engine. This assessment clearly delineates deterministic clinical facts from future LLM-generated explanations.

## 2. Assessment Output Schema (TypeScript Contract)
The engine produces an array of `InteractionAssessment` objects. 

```typescript
export interface InteractionAssessment {
  // 1. Core Identity
  assessment_id: string; // Ephemeral UUID generated on-demand
  generated_at: string;  // ISO Timestamp
  
  // 2. Affected Entities
  patient_id: string;
  affected_medication_ids: string[]; // UUIDs mapping to public.patient_medications
  
  // 3. Clinical Deterministic Facts
  interaction_type: 'medication-medication' | 'medication-food' | 'medication-timing';
  severity: 'low' | 'moderate' | 'high';
  mechanism: string;
  effect: string;
  recommendation_template: string;
  
  // 4. Traceability & Governance
  rule_id: string; // Maps to medical_knowledge.interaction_rules
  rule_version: number;
  
  // 5. Evidence & Jurisdiction
  evidence_references: Array<{
    source: 'rxnorm' | 'dailymed' | 'openfda';
    jurisdiction: 'US-FDA' | 'US-NLM' | 'US' | 'GLOBAL';
    identifier: string;
    citation_text: string;
  }>;
  
  // 6. Escalation Model
  requires_professional_review: boolean; // Computed based on severity thresholds
  
  // 7. Future M6 Expansion (STRICTLY ISOLATED)
  // llm_explanation: string; // DO NOT POPULATE IN M5.
}
```

## 3. Fact vs. Derivation vs. Explanation
- **Rule Fact**: The `severity`, `mechanism`, and `effect` are mapped *exactly* byte-for-byte from the `interaction_rules` database row. They are not summarized or modified by the system.
- **System Derived Assessment**: The `affected_medication_ids` and `requires_professional_review` are derived by the M5 engine contextually for the patient.
- **LLM Explanation**: Excluded entirely from M5. M6 will later take this structured output and write a patient-friendly summary, but the core clinical directives always flow directly from M5.

## 4. Source Jurisdiction Boundary
The `jurisdiction` flag is preserved in every evidence reference inside the assessment. 
- UI implementations consuming this assessment must render a static disclaimer for all non-Indian jurisdictions: `"Evidence sourced from [Jurisdiction]. Consult local medical guidelines."`
- The engine guarantees no evidence will be presented without its jurisdiction tag.
