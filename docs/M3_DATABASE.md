# M3: Database Schema & Migration Specification

## 1. Overview
The M3 migration (`20260901220000_m3_medications_and_schedules.sql`) introduces tables, enums, indexes, and RLS policies for:
1. `patients` timezone column
2. `prescriptions` & `prescription_candidates`
3. `patient_medications`
4. `medication_schedules`
5. `scheduled_doses`
6. `dose_events`

---

## 2. Enums & Types

```sql
create type public.medication_verification_status as enum (
  'verified_rxnorm',
  'unverified',
  'manual_custom'
);

create type public.food_relation_type as enum (
  'no_relation',
  'before_meal',
  'with_meal',
  'after_meal',
  'empty_stomach'
);

create type public.candidate_status as enum (
  'pending',
  'confirmed',
  'rejected'
);

create type public.dose_status as enum (
  'pending',
  'taken',
  'late',
  'skipped',
  'missed'
);

create type public.schedule_slot as enum (
  'morning',
  'afternoon',
  'evening',
  'night',
  'custom'
);
```

---

## 3. Schema Definitions

### 3.1 Patient Timezone Update
```sql
alter table public.patients 
  add column if not exists timezone text not null default 'UTC';
```

### 3.2 Prescriptions & Candidates
```sql
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_name text,
  facility_name text,
  prescription_date date,
  file_path text, -- Supabase Storage key if uploaded
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescription_candidates (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  raw_name text not null,
  raw_dosage text,
  raw_frequency text,
  raw_instructions text,
  suggested_rxcui text,
  suggested_name text,
  status public.candidate_status not null default 'pending',
  confirmed_medication_id uuid, -- set upon confirmation
  created_at timestamptz not null default now()
);
```

### 3.3 Patient Medications
```sql
create table public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  rxcui text,
  display_name text not null,
  generic_name text,
  dosage_amount numeric(8, 2),
  dosage_unit text, -- 'mg', 'ml', 'mcg', etc.
  dosage_form text, -- 'tablet', 'capsule', 'inhaler', etc.
  route text default 'oral',
  food_relation public.food_relation_type not null default 'no_relation',
  administration_instructions text,
  start_date date not null default current_date,
  end_date date,
  is_prn boolean not null default false, -- as-needed medication
  is_active boolean not null default true,
  verification_status public.medication_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.4 Schedules, Scheduled Doses & Dose Events
```sql
create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  time_of_day time not null, -- e.g. 08:00:00 (local time)
  slot_label public.schedule_slot not null default 'morning',
  days_of_week integer[] default null, -- null = daily, or array e.g. {1,3,5} for Mon/Wed/Fri (0=Sun, 6=Sat)
  dose_quantity numeric(6, 2) not null default 1.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.scheduled_doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_medication_id uuid not null references public.patient_medications(id) on delete cascade,
  schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  scheduled_time timestamptz not null, -- projected absolute UTC timestamp
  status public.dose_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (schedule_id, scheduled_time)
);

create table public.dose_events (
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
```

---

## 4. Row Level Security (RLS) Matrix

| Table | Patient Policies | Professional Policies (Active Connection Required) | Anon / Unauth |
| :--- | :--- | :--- | :--- |
| `prescriptions` | SELECT, INSERT, UPDATE, DELETE (`patient_id = auth.uid()`) | SELECT (`exists active connection`) | Deny All |
| `prescription_candidates`| Inherits prescription access via `prescription_id` | Inherits via prescription | Deny All |
| `patient_medications` | SELECT, INSERT, UPDATE, DELETE (`patient_id = auth.uid()`) | SELECT (`exists active connection`) | Deny All |
| `medication_schedules` | SELECT, INSERT, UPDATE, DELETE (`patient_id = auth.uid()`) | SELECT (`exists active connection`) | Deny All |
| `scheduled_doses` | SELECT, INSERT, UPDATE, DELETE (`patient_id = auth.uid()`) | SELECT (`exists active connection`) | Deny All |
| `dose_events` | SELECT, INSERT, UPDATE, DELETE (`patient_id = auth.uid()`) | SELECT (`exists active connection`) | Deny All |

---

## 5. Indexes for Query Performance
```sql
create index idx_patient_medications_patient_active on public.patient_medications (patient_id, is_active);
create index idx_medication_schedules_patient on public.medication_schedules (patient_id, is_active);
create index idx_scheduled_doses_patient_time on public.scheduled_doses (patient_id, scheduled_time);
create index idx_dose_events_patient_time on public.dose_events (patient_id, taken_at);
```
