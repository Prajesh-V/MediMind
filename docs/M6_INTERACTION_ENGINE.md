# M5: Deterministic Medical Interaction Engine

## 1. Overview
The Deterministic Medical Interaction Engine (M5) evaluates a patient's medication list and schedules against the globally approved clinical interaction rules stored in `medical_knowledge.interaction_rules`. 
It serves as the definitive, deterministic evaluation boundary. No LLM is used to determine if an interaction exists or to categorize its severity. AI acts purely as an explanation and summarization layer (M6) *after* the M5 deterministic engine produces a structured assessment.

## 2. Architecture
The engine operates entirely on structured inputs and outputs:
- **Input**: 
  - Patient's active medications (with RxNorm identifiers) from M3.
  - Patient's dose events / schedule times from M3.
  - `medical_knowledge.interaction_rules` where status = `approved`.
- **Processing Engine**: A deterministic rule matcher traversing the approved rules database.
- **Output**: A structured `InteractionAssessment` indicating matching rules, severity, affected medications, and the exact evidence provenance.

### 2.1 Interaction Types Supported
The engine will parse selectors for the following interactions:
1. **Medication ↔ Medication**: Evaluated by intersection of patient's active `rxcui` list and the rule's `medication_selector` (e.g., pairs of RxCUI or ingredient sets).
2. **Medication ↔ Food/component**: Evaluated by cross-referencing medication `food_relation` fields against `food_component_selector`.
3. **Medication ↔ Administration timing**: Evaluated by matching the medication's schedule configuration against `temporal_logic` rules (e.g. "Do not take within 2 hours of dairy").

## 3. Conflict Resolution & Precedence
When multiple rules match for the same medication pair or same clinical situation, deterministic conflict resolution is essential. The engine applies the following explicit precedence:
1. **Severity Maximization**: If multiple rules match the same intersection but differ in severity, the highest severity (`high` > `moderate` > `low`) takes precedence for clinical alerting.
2. **Version Priority**: If a rule has multiple versions (which should not occur simultaneously for `approved` status, as previous versions must be retired), the engine strictly evaluates only rules where `status = 'approved'`. Retired rules are completely ignored during matching.
3. **Cumulative Evidence**: If multiple approved rules of the same severity match (e.g., one from FDA and one from RxNorm for the same drug pair), the assessment combines the rules into a single clinical alert but aggregates the evidence and source provenance in the assessment metadata.

## 4. Assessment Lifecycle & Invalidation
Assessments are generated on-demand when a patient's medication list is viewed by the patient or professional.
- **Persistence**: Due to the dynamic nature of rule approvals and medication changes, structured assessments are computed efficiently in real-time or memoized via caching. They are not stored persistently in a database table as definitive "events" unless explicitly acknowledged or escalated by a professional (which creates an `audit_log` event).
- **Invalidation**: Caches are explicitly invalidated if:
  1. A patient's medication list changes.
  2. A new interaction rule transitions to `approved` or an existing one transitions to `retired`.
- **Reproducibility**: Any generated assessment includes the exact Rule IDs, versions, and timestamp, allowing deterministic reconstruction of the evaluation.

## 5. Security & Isolation
- **Patient Isolation**: Patients can only invoke the engine passing their own `patient_id`.
- **Professional Isolation**: Professionals can only invoke the engine for a `patient_id` with whom they have an `active` connection in M2.
- **Rule Safety**: The engine runs server-side with elevated read access to `medical_knowledge`, but clients cannot manipulate the assessment output or modify rules. 

## 6. Clinical Governance Escalations (Unresolved)
1. **Professional Review Thresholds**: Does a `moderate` severity automatically require professional acknowledgment, or only `high` severity? (Currently flagged for clinical governance decision).
2. **Component Mapping**: Defining an exhaustive taxonomy for `food_component_selector` (e.g., "grapefruit", "calcium") relative to RxNorm requires clinical consensus. M5 will support exact-string or code-based mapping, but the actual codes used must be determined by the medical board.
