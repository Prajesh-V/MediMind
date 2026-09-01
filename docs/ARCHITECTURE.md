# Architecture

```text
Patient / professional browser
  -> Next.js App Router
  -> authenticated server route or server action
  -> domain service + schema validation + authorization
     -> Supabase Postgres / private Storage
     -> medical-source adapters and cache
     -> deterministic interaction engine
     -> Gemini orchestration with allowlisted tools
```

## M0 decisions

- Next.js with strict TypeScript is the planned frontend and backend-for-frontend.
- Supabase is the planned Postgres, Auth, Storage, and RLS provider.
- Vercel is the planned deployment provider.
- Gemini is a future server-side extraction/explanation service only.
- Medical knowledge, patient data, deterministic rules, and LLM responses remain separate layers.

## Boundaries

`reference-artifacts/` is preserved design/product evidence. `src/contracts/` is non-runtime interface scaffolding. `supabase/migrations/` is the single schema-change source. No browser component may possess a service-role key or decide authorization.
