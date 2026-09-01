# Security model

## Data access

- Patients access only their own records.
- Professionals access only patients with an active patient-approved connection.
- Connection code plaintext is never stored; only a hash, expiry, redemption event, and status are persisted.
- Future RLS policies must enforce the same ownership/connection rules as server services.

## Sensitive operations

- Service-role, Gemini, and optional openFDA keys are server-only.
- Prescription and food images use private storage, size/type validation, malware scanning before processing, and short-lived signed URLs.
- Audit clinical-data changes, connection changes, rule lifecycle changes, and professional reviews without leaking PHI into ordinary logs.

## Threat controls

Validate input, rate-limit sensitive endpoints, apply secure sessions and headers, prevent prompt injection from controlling tools, restrict tool arguments, minimize LLM context, and isolate development/preview/production environments.
