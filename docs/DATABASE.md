# Database model and migration conventions

## Conceptual model

```text
profiles -> patient_profiles | professional_profiles
patients <-> patient_professional_connections <-> professionals

patients -> prescriptions -> prescription_extractions -> prescription_medications
patients -> medications -> medication_schedules -> scheduled_doses -> dose_events
patients -> food_records -> food_record_components -> food_components

interaction_rules -> rule_evidence + rule_reviews + rule_lifecycle_events
food_records + doses -> interaction_evaluations -> interaction_events
patients -> safety_reports -> clinical_reviews
```

## M0 schema scope

The M0 migration establishes the private `medical_knowledge` schema and governance tables only: source records, interaction rules, evidence, reviews, and lifecycle events. It creates no patient-facing data tables and inserts no rows.

## Migration rules

- Use UTC timestamp filenames: `YYYYMMDDHHMMSS_description.sql`.
- Migrations are forward-only and transactional where PostgreSQL permits.
- Create data schema, RLS policies, grants, indexes, and tests together when a table becomes exposed in a later milestone.
- Never use demo data in a migration.
- Store shared medical knowledge outside user-owned patient tables.
