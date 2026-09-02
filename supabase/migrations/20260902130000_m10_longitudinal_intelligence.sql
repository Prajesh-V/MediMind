-- ==========================================
-- M10: LONGITUDINAL PATIENT INTELLIGENCE (CORRECTED)
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

alter table public.historical_m6_assessments enable row level security;

create policy "Patients can view their own historical assessments"
  on public.historical_m6_assessments for select
  using (auth.uid() = patient_id);

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

-- 2. Enums
do $$ begin
  create type public.longitudinal_pattern_type as enum (
    'MISSED_DOSE_PATTERN',
    'SKIPPED_DOSE_PATTERN',
    'RECURRING_INTERACTION'
  );
exception when duplicate_object then null;
end $$;

-- 3. Longitudinal Patterns Table
create table if not exists public.longitudinal_patterns (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid not null references public.patients(id) on delete cascade,
    pattern_type public.longitudinal_pattern_type not null,
    target_entity_id text not null, -- Stable identity focus (e.g. medication_id or rule_id)
    pattern_definition_version text not null default '1.0',
    
    first_event_at timestamptz not null,
    last_event_at timestamptz not null,
    observed_at timestamptz not null,
    
    observation_window_days integer not null,
    threshold_value integer not null,
    observation_count integer not null,
    
    source_medication_ids uuid[] default null,
    source_assessment_ids text[] default null,
    source_dose_event_ids uuid[] default null,
    source_dietary_record_ids uuid[] default null,
    
    pattern_fingerprint text not null,
    materialized_at timestamptz not null default now(),
    
    -- Ensure only one active pattern series exists per type/entity per patient
    unique (patient_id, pattern_type, target_entity_id)
);

-- 4. RLS for longitudinal_patterns
alter table public.longitudinal_patterns enable row level security;

create policy "Patients can view their own longitudinal patterns"
  on public.longitudinal_patterns for select
  using (auth.uid() = patient_id);

create policy "Professionals can view patterns for active connections"
  on public.longitudinal_patterns for select
  using (
    exists (
      select 1 from public.patient_professional_connections
      where professional_id = auth.uid()
        and patient_id = longitudinal_patterns.patient_id
        and status = 'active'
    )
  );

-- 5. Longitudinal Acknowledgments Table (M9 Integration)
create table if not exists public.longitudinal_acknowledgments (
    patient_id uuid not null references public.patients(id) on delete cascade,
    professional_id uuid not null references public.professionals(id) on delete cascade,
    pattern_id uuid not null references public.longitudinal_patterns(id) on delete cascade,
    
    pattern_fingerprint text not null,
    acknowledged_at timestamptz not null default now(),
    notes text,
    
    primary key (patient_id, professional_id, pattern_id)
);

-- 6. RLS for longitudinal_acknowledgments
alter table public.longitudinal_acknowledgments enable row level security;

create policy "Professionals can manage longitudinal acknowledgments"
  on public.longitudinal_acknowledgments for all
  using (
    professional_id = auth.uid() and
    exists (
      select 1 from public.patient_professional_connections
      where professional_id = auth.uid()
        and patient_id = longitudinal_acknowledgments.patient_id
        and status = 'active'
    )
  );

-- 7. Atomic RPC for Acknowledging Longitudinal Patterns (M9/M8 Integration)
create or replace function public.acknowledge_longitudinal_atomic(
    p_patient_id uuid,
    p_pattern_id uuid,
    p_pattern_fingerprint text,
    p_notes text,
    p_trace_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prof_id uuid;
    v_has_connection boolean;
begin
    -- 1. Authenticate Professional
    v_prof_id := auth.uid();
    if v_prof_id is null then
        raise exception 'Unauthorized: Must be authenticated';
    end if;

    -- 2. Authorize Connection
    select exists (
        select 1 from patient_professional_connections
        where patient_id = p_patient_id
          and professional_id = v_prof_id
          and status = 'active'
    ) into v_has_connection;

    if not v_has_connection then
        raise exception 'Forbidden: No active connection with this patient';
    end if;

    -- 3. Upsert into longitudinal_acknowledgments (M9 materialized state)
    insert into longitudinal_acknowledgments (
        patient_id, professional_id, pattern_id, pattern_fingerprint, acknowledged_at, notes
    )
    values (
        p_patient_id, v_prof_id, p_pattern_id, p_pattern_fingerprint, now(), coalesce(p_notes, 'Reviewed via Clinical Workspace')
    )
    on conflict (patient_id, professional_id, pattern_id)
    do update set
        pattern_fingerprint = excluded.pattern_fingerprint,
        acknowledged_at = excluded.acknowledged_at,
        notes = excluded.notes;

    -- 4. Insert trace event (Will throw 23505 if OCC hash collision occurs, rolling back the entire transaction!)
    insert into clinical_trace_events (
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

    return jsonb_build_object('success', true);
end;
$$;

commit;
