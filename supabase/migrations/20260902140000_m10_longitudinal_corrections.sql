-- ==========================================
-- M10: LONGITUDINAL PATIENT INTELLIGENCE (CORRECTIONS)
-- ==========================================

begin;

-- 1. Historical M6 Assessment Persistence
create table if not exists public.historical_m6_assessments (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid not null references public.patients(id) on delete cascade,
    assessment_id text not null,
    rule_id text not null,
    rule_version integer not null,
    severity text not null,
    state_fingerprint text not null,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    source_medication_ids uuid[] default null,
    
    unique (patient_id, rule_id, state_fingerprint)
);

do $$ 
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Patients can view their own historical assessments'
  ) then
    create policy "Patients can view their own historical assessments"
      on public.historical_m6_assessments for select
      using (auth.uid() = patient_id);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Professionals can view historical assessments for active connections'
  ) then
    create policy "Professionals can view historical assessments for active connections"
      on public.historical_m6_assessments for select
      using (
        exists (
          select 1 from public.patient_professional_connections
          where professional_id = auth.uid()
            and patient_id = historical_m6_assessments.patient_id
            and status = 'active'
        )
      );
  end if;
end $$;

-- 2. Add target_entity_id to longitudinal_patterns and backfill
alter table public.longitudinal_patterns 
add column if not exists target_entity_id text;

update public.longitudinal_patterns
set target_entity_id = source_medication_ids[1]::text
where pattern_type in ('MISSED_DOSE_PATTERN', 'SKIPPED_DOSE_PATTERN')
  and target_entity_id is null
  and source_medication_ids is not null
  and array_length(source_medication_ids, 1) > 0;

delete from public.longitudinal_patterns where target_entity_id is null;

alter table public.longitudinal_patterns 
alter column target_entity_id set not null;

alter table public.longitudinal_patterns
drop constraint if exists longitudinal_patterns_patient_id_pattern_type_pattern_f_key;

alter table public.longitudinal_patterns
drop constraint if exists longitudinal_patterns_identity_key;

alter table public.longitudinal_patterns
add constraint longitudinal_patterns_identity_key unique (patient_id, pattern_type, target_entity_id);

-- 3. Atomic RPC for Pattern Materialization & M8 Trace Emission
create or replace function public.materialize_longitudinal_pattern_atomic(
    p_pattern jsonb,
    p_trace_payload jsonb,
    p_mutation_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pattern_id uuid;
begin
    if p_mutation_type = 'NEW' then
        insert into public.longitudinal_patterns (
            id, patient_id, pattern_type, target_entity_id, pattern_definition_version,
            first_event_at, last_event_at, observed_at, observation_window_days,
            threshold_value, observation_count, source_medication_ids, source_assessment_ids,
            source_dose_event_ids, source_dietary_record_ids, pattern_fingerprint
        ) values (
            (p_pattern->>'id')::uuid,
            (p_pattern->>'patient_id')::uuid,
            (p_pattern->>'pattern_type')::public.longitudinal_pattern_type,
            p_pattern->>'target_entity_id',
            p_pattern->>'pattern_definition_version',
            (p_pattern->>'first_event_at')::timestamptz,
            (p_pattern->>'last_event_at')::timestamptz,
            (p_pattern->>'observed_at')::timestamptz,
            (p_pattern->>'observation_window_days')::integer,
            (p_pattern->>'threshold_value')::integer,
            (p_pattern->>'observation_count')::integer,
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_medication_ids') x),
            (select array_agg(x) from jsonb_array_elements_text(p_pattern->'source_assessment_ids') x),
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_dose_event_ids') x),
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_dietary_record_ids') x),
            p_pattern->>'pattern_fingerprint'
        ) returning id into v_pattern_id;
    else
        update public.longitudinal_patterns
        set 
            pattern_fingerprint = p_pattern->>'pattern_fingerprint',
            first_event_at = (p_pattern->>'first_event_at')::timestamptz,
            last_event_at = (p_pattern->>'last_event_at')::timestamptz,
            observed_at = (p_pattern->>'observed_at')::timestamptz,
            observation_count = (p_pattern->>'observation_count')::integer,
            source_medication_ids = (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_medication_ids') x),
            source_assessment_ids = (select array_agg(x) from jsonb_array_elements_text(p_pattern->'source_assessment_ids') x),
            source_dose_event_ids = (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_dose_event_ids') x),
            source_dietary_record_ids = (select array_agg(x::uuid) from jsonb_array_elements_text(p_pattern->'source_dietary_record_ids') x)
        where id = (p_pattern->>'id')::uuid
        returning id into v_pattern_id;
    end if;

    insert into public.clinical_trace_events (
        patient_id,
        assessment_id,
        event_type,
        event_timestamp,
        actor_type,
        actor_id,
        source_component,
        source_version,
        metadata,
        previous_event_hash,
        event_hash
    ) values (
        (p_trace_payload->>'patient_id')::uuid,
        p_trace_payload->>'assessment_id',
        p_trace_payload->>'event_type',
        (p_trace_payload->>'event_timestamp')::timestamptz,
        p_trace_payload->>'actor_type',
        (p_trace_payload->>'actor_id')::uuid,
        p_trace_payload->>'source_component',
        p_trace_payload->>'source_version',
        p_trace_payload->'metadata',
        p_trace_payload->>'previous_event_hash',
        p_trace_payload->>'event_hash'
    );

    return jsonb_build_object('success', true, 'pattern_id', v_pattern_id);
end;
$$;

commit;
