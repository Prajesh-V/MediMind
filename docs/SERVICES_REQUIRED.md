# Services required

| Service | Purpose | MVP | Key required | Environment variable | Status |
|---|---|---:|---:|---|---|
| Supabase | Auth, Postgres, Storage, RLS | Yes | Project keys | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Needs project/configuration |
| Vercel | Hosting and environment configuration | Yes | Project integration | Platform-managed | Needs project/configuration |
| Gemini API | Candidate extraction and tool-based explanation | Later | Yes | `GEMINI_API_KEY` | Not integrated in M0 |
| RxNorm | Drug normalization | Yes | Verify before launch | `RXNORM_BASE_URL` | Adapter contract only |
| DailyMed | Official SPL/label retrieval | Yes | Verify before launch | `DAILYMED_BASE_URL` | Adapter contract only |
| openFDA | Structured public drug-label data | Yes | Optional for higher limits | `OPENFDA_API_KEY`, `OPENFDA_BASE_URL` | Adapter contract only |
| PubChem | Chemical/compound enrichment | No | Deferred | None in M0 | Optional later |

Do not paste a secret into source code or commit a populated `.env` file.
