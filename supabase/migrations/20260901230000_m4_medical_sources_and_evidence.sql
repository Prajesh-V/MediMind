begin;

-- 1. Add authorized_reviewers table
create table medical_knowledge.authorized_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  notes text,
  check (revoked_at is null or revoked_at > granted_at)
);

comment on table medical_knowledge.authorized_reviewers is 'Server-managed list of authorized clinical reviewers. Replaces any reliance on client-side role metadata.';

-- 2. Modify source_records for Jurisdiction and Payload sizing
alter table medical_knowledge.source_records
  add column jurisdiction text not null default 'US' check (jurisdiction in ('US-FDA', 'US-NLM', 'US', 'GLOBAL')),
  add column raw_payload jsonb;

-- Ensure raw payloads don't exceed a soft bound (Postgres handles large jsonb but we enforce a logical check or document it)
-- We will enforce size limits in the application layer adapter.

-- 3. Enable RLS on all medical_knowledge tables
alter table medical_knowledge.source_records enable row level security;
alter table medical_knowledge.interaction_rules enable row level security;
alter table medical_knowledge.rule_evidence enable row level security;
alter table medical_knowledge.rule_reviews enable row level security;
alter table medical_knowledge.rule_lifecycle_events enable row level security;
alter table medical_knowledge.authorized_reviewers enable row level security;

-- 4. RLS Policies
-- Only service_role can mutate these tables directly (or specific functions).
-- Authorized reviewers can read them.
create policy "Reviewers can read authorized_reviewers"
  on medical_knowledge.authorized_reviewers for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

create policy "Reviewers can read source_records"
  on medical_knowledge.source_records for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

create policy "Reviewers can read interaction_rules"
  on medical_knowledge.interaction_rules for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

-- We also need a policy for anyone to read APPROVED rules for the patient-facing evaluation engine later.
create policy "Anyone can read approved interaction_rules"
  on medical_knowledge.interaction_rules for select
  using (status = 'approved');

create policy "Reviewers can read rule_evidence"
  on medical_knowledge.rule_evidence for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

create policy "Anyone can read evidence for approved rules"
  on medical_knowledge.rule_evidence for select
  using (
    exists (select 1 from medical_knowledge.interaction_rules where id = rule_evidence.rule_id and status = 'approved')
  );

create policy "Reviewers can read rule_reviews"
  on medical_knowledge.rule_reviews for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

create policy "Reviewers can read rule_lifecycle_events"
  on medical_knowledge.rule_lifecycle_events for select
  using (
    exists (select 1 from medical_knowledge.authorized_reviewers where user_id = auth.uid() and revoked_at is null)
  );

-- 5. Update enforce_rule_lifecycle to use authorized_reviewers instead of auth.users blindly
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
    
    -- M4: Enforce that the approved_by user is an active authorized_reviewer
    if not exists (
      select 1
      from medical_knowledge.authorized_reviewers
      where user_id = new.approved_by and revoked_at is null
    ) then
      raise exception 'approving user is not an active authorized reviewer';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

commit;
