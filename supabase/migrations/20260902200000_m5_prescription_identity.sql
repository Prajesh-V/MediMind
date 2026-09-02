begin;

-- Extend M3 prescriptions with identity and summary fields
alter table public.prescriptions
  add column if not exists title text,
  add column if not exists ai_summary text;

commit;
