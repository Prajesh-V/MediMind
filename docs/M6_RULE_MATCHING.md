# M5: Rule Matching Strategy

## 1. Goal
Evaluate a patient's context (active medications, schedules) against deterministic JSON rules to find matches. No semantic similarity or LLM embeddings are permitted for the final clinical determination. Matching is strictly boolean (match or no match) based on explicit structural criteria.

## 2. Medication Selector Matching
The `medication_selector` JSONB field in `medical_knowledge.interaction_rules` defines what medications trigger the rule.

### Structure
```json
{
  "type": "exact_rxcui" | "ingredient",
  "entities": ["rxcui_1", "rxcui_2"],
  "condition": "ALL" | "ANY"
}
```

### Matching Algorithm
1. **Fetch Patient Medications**: Retrieve all `rxcui` values for the patient's currently active medications.
2. **Exact RxCUI Match**: If `type === 'exact_rxcui'`, the engine performs a set intersection. If `condition === 'ALL'`, the patient must be taking all `entities`. If `condition === 'ANY'`, taking at least one satisfies the selector.
3. **Ingredient Match**: If `type === 'ingredient'`, the engine must first resolve the patient's RxCUI to its ingredient base (via RxNorm API or cache) and then perform the set intersection.

## 3. Food Component Selector Matching
The `food_component_selector` specifies dietary interactions.

### Structure
```json
{
  "components": ["grapefruit", "dairy", "high_fat"],
  "condition": "ANY"
}
```

### Matching Algorithm
1. This is matched against the `food_relation` string of the patient's medication, but since `food_relation` is often free-text (e.g. "with food", "avoid dairy"), M5 matching will require a standardized enum mapping during manual M3 entry, or it will operate purely as a temporal constraint flag. 
2. *Clinical Governance Decision*: Until M3 enforces a structured enum for dietary intake, food rules will match if the medication hits the `medication_selector` and the `food_component_selector` is populated, generating a constant warning (e.g. "Avoid Grapefruit while on Statins") attached to the drug.

## 4. Temporal Logic Matching
The `temporal_logic` field evaluates dose schedules.

### Structure
```json
{
  "type": "separation",
  "target": "dairy",
  "min_hours_separation": 2
}
```

### Matching Algorithm
1. This logic compares two scheduled dose events (or a dose and a meal time). 
2. If two interacting medications are scheduled within `min_hours_separation` of each other, the engine produces an explicit scheduling alert.

## 5. Performance and Scale
- **In-Memory Filtering**: Because the total number of *active, approved* rules for a specific patient's medication profile is computationally small, the engine pulls all approved rules related to the patient's active RxCUIs from the database and evaluates them entirely in-memory using fast set intersections.
- **Database Indexing**: The query will utilize Postgres GIN indexing on the `medication_selector` JSONB column to rapidly filter candidate rules before application-level evaluation.
