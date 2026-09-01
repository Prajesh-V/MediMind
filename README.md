# MediMind

MediMind is an AI-assisted medication and healthcare companion. It combines patient-recorded medication and food timing with deterministic, evidence-traceable interaction rules and professional review.

## M0 status

This repository currently contains architecture and governance foundations only. It does not yet contain a runnable application, production patient data, active clinical rules, or patient-facing AI.

## Repository conventions

- `docs/` contains the approved product, architecture, safety, deployment, and test specifications.
- `reference-artifacts/` preserves the supplied prototype and supporting source material. These files are reference material, not executable product code.
- `src/contracts/` contains compile-time contracts only; it must remain free of runtime credentials and clinical data.
- `supabase/migrations/` contains forward-only, timestamp-prefixed PostgreSQL migrations. Never edit a migration after it has been applied to a shared environment.
- `supabase/seed.demo.sql` is intentionally empty of patient data in M0. Any later fixture must be opt-in and blocked from production.

## Safety boundary

The LLM is not a clinical authority. A patient-facing interaction assessment may only be produced by an approved, versioned MediMind rule with linked evidence. Unsupported medication or missing evidence must produce an evidence-unavailable response and professional escalation.

See [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) for the approved delivery sequence.
