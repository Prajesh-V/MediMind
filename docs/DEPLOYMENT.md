# Deployment and environment model

## Environments

| Environment | Purpose | Data rule |
|---|---|---|
| Development | Local engineering | Opt-in synthetic/demo fixtures only |
| Preview | Pull-request validation | No production PHI or production credentials |
| Production | Live service | No demo fixture execution; no development rules |

Each environment receives a separate Supabase project and Vercel environment-variable set. Production secrets are configured in the deployment platform, never committed.

## Deployment path

GitHub -> Vercel preview/production deployment. Database migrations are reviewed and applied in order through a controlled deployment workflow. Production rule publication requires the separate clinical approval process described in `MEDICAL_SAFETY.md`.
