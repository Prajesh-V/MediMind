# API specification — M0 contracts

No HTTP endpoints are implemented in M0. This document reserves the future resource boundaries so frontend work does not bypass authorization or domain validation.

| Resource group | Future responsibility |
|---|---|
| `/api/profile` | Authenticated profile and preferences |
| `/api/connections` | Patient connection codes, redemption, approval, revocation |
| `/api/prescriptions` | Private document workflow, candidate extraction, confirmation |
| `/api/medications` | Confirmed medication, schedules, and dose events |
| `/api/food-records` | Manual/image candidate food records and confirmation |
| `/api/interactions` | Deterministic evaluation and evidence retrieval |
| `/api/safety-reports` | Patient reports and authorized professional review |
| `/api/chat` | Tool-mediated, read-only AI explanations |

Every endpoint must authenticate, validate input, authorize the target record, use a domain service, and return explicit errors. No endpoint may accept an LLM conclusion as a clinical fact.
