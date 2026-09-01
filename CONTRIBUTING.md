# Contributing to MediMind

## Working rules

- Use TypeScript strict mode when application code begins in M1.
- Keep browser code free of secrets, privileged database keys, medical-source credentials, and authorization decisions.
- Validate all external input at the server boundary. Treat client input, OCR, image recognition, LLM output, and cached external data as untrusted until validated.
- Make database changes only through a new forward-only migration in `supabase/migrations/`.
- Do not alter an applied migration. Write a corrective migration instead.
- Do not add patient data, medical records, or approved clinical rules as fixtures or seeds.
- Keep demo fixtures isolated, opt-in, clearly labeled, and blocked in production.
- Do not claim a rule is clinically approved unless a qualified reviewer has completed the documented approval workflow.

## Change quality

- Add unit tests with domain logic, integration tests for API/database boundaries, and RLS tests for access controls.
- Require explicit loading, error, and empty states for all user-facing data.
- Record audit events for clinical-data changes, rule lifecycle actions, connection access changes, and professional safety reviews.
- Keep user-visible health claims traceable to verified source/rule data.

## Commit conventions

Use focused commits with imperative subjects, for example `docs: define rule lifecycle` or `db: add medication schedule migration`. Never commit `.env*` files other than `.env.example`.
