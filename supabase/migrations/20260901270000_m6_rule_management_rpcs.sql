begin;

-- ==========================================
-- M6: RULE MANAGEMENT RPCs
-- ==========================================

-- 1. Submit Rule
create or replace function public.submit_interaction_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  update medical_knowledge.interaction_rules
  set status = 'submitted'
  where id = p_rule_id and status = 'draft';
end;
$$;

-- 2. Approve Rule
create or replace function public.approve_interaction_rule(p_rule_id uuid, p_reviewer_credential text default 'System-verified')
returns void
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  -- Insert the required review record
  insert into medical_knowledge.rule_reviews (
    rule_id, reviewer_user_id, reviewer_credential_reference, decision, review_note
  ) values (
    p_rule_id, auth.uid(), p_reviewer_credential, 'approved', 'Approved via M4 flow'
  );

  -- Transition the rule to approved
  update medical_knowledge.interaction_rules
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      effective_from = now()
  where id = p_rule_id and status = 'submitted';
end;
$$;

-- 3. Reject Rule
create or replace function public.reject_interaction_rule(p_rule_id uuid, p_reason text, p_reviewer_credential text default 'System-verified')
returns void
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  if not exists (
    select 1 from medical_knowledge.authorized_reviewers
    where user_id = auth.uid() and revoked_at is null
  ) then
    raise exception 'Forbidden: Must be an active authorized clinical reviewer';
  end if;

  -- Insert the required review record
  insert into medical_knowledge.rule_reviews (
    rule_id, reviewer_user_id, reviewer_credential_reference, decision, review_note
  ) values (
    p_rule_id, auth.uid(), p_reviewer_credential, 'rejected', p_reason
  );

  -- Transition the rule back to draft
  update medical_knowledge.interaction_rules
  set status = 'draft'
  where id = p_rule_id and status = 'submitted';
end;
$$;

-- 4. Retire Rule
create or replace function public.retire_interaction_rule(p_rule_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
begin
  if not exists (
    select 1 from medical_knowledge.authorized_reviewers
    where user_id = auth.uid() and revoked_at is null
  ) then
    raise exception 'Forbidden: Must be an active authorized clinical reviewer';
  end if;

  update medical_knowledge.interaction_rules
  set status = 'retired',
      retired_at = now(),
      retired_reason = p_reason
  where id = p_rule_id and status = 'approved';
end;
$$;

commit;
