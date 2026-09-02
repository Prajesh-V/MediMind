-- ==========================================
-- M3: MEDICATIONS, PRESCRIPTIONS, SCHEDULES, DOSES & ADHERENCE
-- ==========================================

begin;

-- 1. Enums
do $$ begin
  create type public.medication_verification_status as enum (
    'verified_rxnorm',
    'unverified',
    'manual_custom'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.food_relation_type as enum (
    'no_relation',
    'before_meal',
    'with_meal',
    'after_meal',
    'empty_stomach'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.candidate_status as enum (
    'pending',
    'confirmed',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.dose_status as enum (
    'pending',
    'taken',
    'late',
    'skipped',
    'missed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.schedule_slot as enum (
    'morning',
    'afternoon',
    'evening',
    'night',
    'custom'
  );
exception when duplicate_object then null;
end $$;

-- 2. Add Timezone to Patients Table
alter table public.patients 
  add column if not exists timezone text not null default 'UTC';

-- 3. Prescriptions Table
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_name text,
  facility_name text,
  prescription_date date,
  file_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Prescription Candidates (Staging) Table
create table if not exists public.prescription_candidates (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  raw_name text not null,
  raw_dosage text,
  raw_frequency text,
  raw_instructions text,
  suggested_rxcui text,
  suggested_name text,
  status public.candidate_status not null default 'pending',
  confirmed_medication_id uuid,
  created_at timestamptz not null default now()
);

-- 5. Patient Medications Table
create table if not exists public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  rxcui text,
  display_name text not null,
  generic_name text,
  dosage_amount numeric(8, 2),
  dosage_unit text,
  dosage_form text,
  route text default 'oral',
  food_relation public.food_relation_type not null default 'no_relation',
  administration_instructions text,
  start_date date not null default current_date,
  end_date date,
  is_prn boolean not null default false,
  is_active boolean not null default true,
  verification_status public.medication_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Medication Schedules Table
create table if not exists public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  time_of_day time not null,
  slot_label public.schedule_slot not null default 'morning',
  days_of_week integer[] default null, -- null = daily; or array e.g. {1,2,3,4,5} (0=Sun, 6=Sat)
  dose_quantity numeric(6, 2) not null default 1.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 7. Scheduled Doses Table (Projected discrete UTC timestamps)
create table if not exists public.scheduled_doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  scheduled_time timestamptz not null,
  status public.dose_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (schedule_id, scheduled_time)
);

-- 8. Dose Events Table (Actual recorded doses)
create table if not exists public.dose_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  scheduled_dose_id uuid references public.scheduled_doses(id) on delete set null,
  status public.dose_status not null default 'taken',
  recorded_at timestamptz not null default now(),
  taken_at timestamptz not null default now(),
  dose_quantity numeric(6, 2) not null default 1.0,
  notes text,
  created_at timestamptz not null default now()
);

-- 9. Row Level Security (Deny-by-default)
alter table public.prescriptions enable row level security;
alter table public.prescription_candidates enable row level security;
alter table public.patient_medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.scheduled_doses enable row level security;
alter table public.dose_events enable row level security;

-- 10. RLS Policies

-- Prescriptions
create policy "Patients manage own prescriptions"
  on public.prescriptions for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read active patient prescriptions"
  on public.prescriptions for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = prescriptions.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Prescription Candidates
create policy "Patients manage own prescription candidates"
  on public.prescription_candidates for all
  using (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_candidates.prescription_id
      and p.patient_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_candidates.prescription_id
      and p.patient_id = auth.uid()
    )
  );

create policy "Professionals read active patient prescription candidates"
  on public.prescription_candidates for select
  using (
    exists (
      select 1 from public.prescriptions p
      join public.patient_professional_connections c on c.patient_id = p.patient_id
      where p.id = prescription_candidates.prescription_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Patient Medications
create policy "Patients manage own medications"
  on public.patient_medications for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read active patient medications"
  on public.patient_medications for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = patient_medications.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Medication Schedules
create policy "Patients manage own schedules"
  on public.medication_schedules for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read active patient schedules"
  on public.medication_schedules for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = medication_schedules.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Scheduled Doses
create policy "Patients manage own scheduled doses"
  on public.scheduled_doses for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read active patient scheduled doses"
  on public.scheduled_doses for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = scheduled_doses.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Dose Events
create policy "Patients manage own dose events"
  on public.dose_events for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read active patient dose events"
  on public.dose_events for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = dose_events.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- 11. Triggers for updated_at
create trigger update_prescriptions_modtime 
  before update on public.prescriptions 
  for each row execute function update_modified_column();

create trigger update_patient_medications_modtime 
  before update on public.patient_medications 
  for each row execute function update_modified_column();

-- 12. Performance Indexes
create index if not exists idx_patient_medications_patient_active on public.patient_medications (patient_id, is_active);
create index if not exists idx_medication_schedules_patient on public.medication_schedules (patient_id, is_active);
create index if not exists idx_scheduled_doses_patient_time on public.scheduled_doses (patient_id, scheduled_time);
create index if not exists idx_dose_events_patient_time on public.dose_events (patient_id, taken_at);

commit;
