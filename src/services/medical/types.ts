export type InteractionType = 'medication-medication' | 'medication-food' | 'medication-timing';
export type SeverityLevel = 'low' | 'moderate' | 'high';

export interface EvidenceReference {
  source: 'rxnorm' | 'dailymed' | 'openfda' | 'pubchem';
  jurisdiction: 'US-FDA' | 'US-NLM' | 'US' | 'GLOBAL';
  identifier: string;
  citation_text: string;
  source_url: string;
  evidence_grade?: string | null;
}

export interface InteractionAssessment {
  // 1. Core Identity
  assessment_id: string; // Deterministic UUID or hash
  state_fingerprint: string; // Cryptographic hash of exact canonical inputs (meds, diet, rule ver)
  generated_at: string;  // ISO Timestamp

  // 2. Affected Entities
  patient_id: string;
  affected_medication_ids: string[]; // UUIDs from public.patient_medications
  affected_medication_names: string[];
  affected_food_components?: string[];

  // 3. Clinical Deterministic Facts (Direct from rule, unedited by AI)
  interaction_type: InteractionType;
  severity: SeverityLevel;
  mechanism: string;
  effect: string;
  recommendation_template: string;

  // 4. Traceability & Governance
  rule_id: string;
  rule_key: string;
  rule_version: number;

  // 5. Evidence & Jurisdiction
  evidence_references: EvidenceReference[];

  // 6. Escalation Model
  requires_professional_review: boolean; // e.g. severity === 'high'
}

export interface RuleMedicationSelector {
  type: 'exact_rxcui' | 'ingredient';
  entities: string[]; // array of rxcuis or ingredient strings
  condition: 'ALL' | 'ANY';
}

export interface RuleFoodSelector {
  components: string[]; // e.g. ['grapefruit', 'dairy', 'high_fat', 'alcohol']
  condition: 'ALL' | 'ANY';
}

export interface RuleTemporalLogic {
  type: 'separation' | 'co_administration_limit' | 'none';
  target?: string;
  min_hours_separation?: number;
  max_hours_window?: number;
}

export interface DatabaseInteractionRule {
  id: string;
  rule_key: string;
  version: number;
  status: 'draft' | 'submitted' | 'approved' | 'retired';
  medication_selector: RuleMedicationSelector;
  food_component_selector: RuleFoodSelector;
  temporal_logic: RuleTemporalLogic;
  severity: SeverityLevel;
  mechanism: string;
  effect: string;
  recommendation_template: string;
  effective_from: string | null;
  effective_until: string | null;
  rule_evidence?: Array<{
    id: string;
    citation_text: string;
    source_url: string;
    evidence_grade: string | null;
    source_record_id: string | null;
    source_records?: {
      source_name: 'rxnorm' | 'dailymed' | 'openfda' | 'pubchem';
      external_identifier: string;
    } | null;
  }>;
}

export interface PatientMedicationContext {
  id: string;
  rxcui: string | null;
  display_name: string;
  generic_name: string | null;
  food_relation: 'no_relation' | 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach';
  administration_instructions?: string | null;
  schedules?: Array<{
    id: string;
    time_of_day: string; // '08:00:00'
    slot_label: string;
    days_of_week?: number[] | null;
    dose_quantity: number;
  }>;
}

export interface PatientDietaryContext {
  id: string;
  component_name: string;
  consumed_at: string;
}

export interface PatientEvaluationContext {
  patient_id: string;
  medications: PatientMedicationContext[];
  dietary_records?: PatientDietaryContext[];
}

export interface ExplanationOutput {
  summary: string;
  why_this_matters: string;
  what_was_detected: string;
  what_the_system_determined: string;
  next_steps: string[];
  limitations: string;
  source_references: string[];
}

export type TraceEventType = 
  | 'INPUT_CONFIRMED'
  | 'assessment_created'
  | 'assessment_resolved'
  | 'PROFESSIONAL_ACKNOWLEDGED'
  | 'LONGITUDINAL_PATTERN_DETECTED'
  | 'LONGITUDINAL_PATTERN_REVIEWED'
  | 'LONGITUDINAL_PATTERN_STATE_CHANGED'
  | 'EXPLANATION_GENERATED' 
  | 'EXPLANATION_FAILED';

export interface ClinicalTraceEvent {
  id: string;
  patient_id: string;
  assessment_id?: string | null;
  event_type: TraceEventType;
  event_timestamp: string;
  actor_type: 'patient' | 'professional' | 'system';
  actor_id?: string | null;
  source_component: string;
  source_version: string;
  metadata: Record<string, any>;
  previous_event_hash: string;
  event_hash: string;
  created_at: string;
}

export interface HistoricalM6Assessment {
  id: string;
  patient_id: string;
  assessment_id: string;
  rule_id: string;
  rule_version: number;
  severity: string;
  state_fingerprint: string;
  first_seen_at: string;
  last_seen_at: string;
  source_medication_ids: string[] | null;
}

export type LongitudinalPatternType = 'MISSED_DOSE_PATTERN' | 'SKIPPED_DOSE_PATTERN' | 'RECURRING_INTERACTION';

export interface LongitudinalPattern {
  id: string;
  patient_id: string;
  pattern_type: LongitudinalPatternType;
  target_entity_id: string;
  pattern_definition_version: string;
  first_event_at: string;
  last_event_at: string;
  observed_at: string;
  observation_window_days: number;
  threshold_value: number;
  observation_count: number;
  source_medication_ids: string[] | null;
  source_assessment_ids: string[] | null;
  source_dose_event_ids: string[] | null;
  source_dietary_record_ids: string[] | null;
  deterministic_summary?: Record<string, any>;
  pattern_fingerprint: string;
  materialized_at?: string;
}
