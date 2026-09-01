begin;

create schema if not exists medical_knowledge;
revoke all on schema medical_knowledge from public;

create type medical_knowledge.rule_status as enum (
  'draft',
  'submitted',
  'approved',
  'retired'
);

create type medical_knowledge.review_decision as enum (
  'approved',
  'rejected'
);

create table medical_knowledge.source_records (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (source_name in ('rxnorm', 'dailymed', 'openfda', 'pubchem')),
  external_identifier text not null,
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  source_version text,
  payload_hash text not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_name, external_identifier, payload_hash)
);

create table medical_knowledge.interaction_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  version integer not null check (version > 0),
  status medical_knowledge.rule_status not null default 'draft',
  medication_selector jsonb not null,
  food_component_selector jsonb not null,
  temporal_logic jsonb not null,
  severity text not null check (severity in ('low', 'moderate', 'high')),
  mechanism text not null,
  effect text not null,
  recommendation_template text not null,
  effective_from timestamptz,
  effective_until timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  retired_at timestamptz,
  retired_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_key, version),
  check (effective_until is null or effective_from is null or effective_until > effective_from),
  check (
    (status = 'approved' and approved_by is not null and approved_at is not null and effective_from is not null)
    or (status <> 'approved')
  ),
  check (
    (status = 'retired' and retired_at is not null and retired_reason is not null)
    or (status <> 'retired')
  )
);

create table medical_knowledge.rule_evidence (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references medical_knowledge.interaction_rules(id) on delete cascade,
  source_record_id uuid references medical_knowledge.source_records(id),
  citation_text text not null,
  source_url text not null,
  evidence_grade text,
  excerpt_locator text,
  created_at timestamptz not null default now()
);

create table medical_knowledge.rule_reviews (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references medical_knowledge.interaction_rules(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id),
  reviewer_credential_reference text not null,
  decision medical_knowledge.review_decision not null,
  review_note text not null,
  reviewed_at timestamptz not null default now(),
  unique (rule_id, reviewer_user_id, decision)
);

create table medical_knowledge.rule_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references medical_knowledge.interaction_rules(id) on delete restrict,
  from_status medical_knowledge.rule_status,
  to_status medical_knowledge.rule_status not null,
  changed_by uuid references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create or replace function medical_knowledge.enforce_rule_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'retired' and new.status <> 'retired' then
    raise exception 'retired rules cannot return to an executable lifecycle state';
  end if;

  if tg_op = 'UPDATE' and old.status <> new.status and not (
    (old.status = 'draft' and new.status = 'submitted')
    or (old.status = 'submitted' and new.status = 'draft')
    or (old.status = 'submitted' and new.status = 'approved')
    or (old.status = 'approved' and new.status = 'retired')
  ) then
    raise exception 'invalid rule lifecycle transition from % to %', old.status, new.status;
  end if;

  if new.status = 'approved' then
    if not exists (
      select 1
      from medical_knowledge.rule_evidence evidence
      where evidence.rule_id = new.id
    ) then
      raise exception 'approved rule requires linked evidence';
    end if;

    if not exists (
      select 1
      from medical_knowledge.rule_reviews review
      where review.rule_id = new.id
        and review.reviewer_user_id = new.approved_by
        and review.decision = 'approved'
    ) then
      raise exception 'approved rule requires a matching qualified reviewer approval record';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function medical_knowledge.record_rule_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into medical_knowledge.rule_lifecycle_events (rule_id, from_status, to_status, changed_by, reason)
    values (new.id, null, new.status, auth.uid(), 'Rule created');
  elsif old.status is distinct from new.status then
    insert into medical_knowledge.rule_lifecycle_events (rule_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(), null);
  end if;
  return new;
end;
$$;

create trigger enforce_interaction_rule_lifecycle
before insert or update on medical_knowledge.interaction_rules
for each row execute function medical_knowledge.enforce_rule_lifecycle();

create trigger record_interaction_rule_lifecycle
after insert or update on medical_knowledge.interaction_rules
for each row execute function medical_knowledge.record_rule_lifecycle_event();

create index interaction_rules_status_effective_idx
on medical_knowledge.interaction_rules (status, effective_from, effective_until);

create index rule_evidence_rule_id_idx
on medical_knowledge.rule_evidence (rule_id);

create index rule_reviews_rule_id_idx
on medical_knowledge.rule_reviews (rule_id);

comment on schema medical_knowledge is
  'Private shared medical-source cache and deterministic rule governance. No patient data is stored here.';
comment on table medical_knowledge.interaction_rules is
  'Versioned deterministic interaction rules. M0 inserts no rows; only approved, reviewed, evidence-linked rules may later execute in production.';

commit;
