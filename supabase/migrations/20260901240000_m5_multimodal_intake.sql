begin;

-- ==========================================
-- TYPES
-- ==========================================

create type public.document_category as enum ('prescription', 'food');
create type public.extraction_status as enum ('pending', 'success', 'failed');
create type public.confidence_level as enum ('high', 'low', 'missing', 'conflicting');

-- ==========================================
-- UPLOADED DOCUMENTS
-- ==========================================

create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  storage_path text not null,
  file_type text not null,
  document_category public.document_category not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- EXTRACTION RUNS
-- ==========================================

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.uploaded_documents(id) on delete cascade,
  service_provider text not null,
  status public.extraction_status not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- EXTEND M3 PRESCRIPTION CANDIDATES
-- ==========================================

-- M3 existing table public.prescription_candidates already handles candidate staging.
-- We add the extraction_run_id to maintain the unbroken provenance chain:
-- uploaded_documents -> extraction_runs -> prescription_candidates -> patient_medications.
-- Also add OCR confidence fields.

alter table public.prescription_candidates
  add column extraction_run_id uuid references public.extraction_runs(id) on delete set null,
  add column extraction_confidence public.confidence_level,
  add column extraction_warnings text[];

-- ==========================================
-- FOOD INTAKE CANDIDATES
-- ==========================================

create table public.food_intake_candidates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  extraction_run_id uuid not null references public.extraction_runs(id) on delete cascade,
  component_name text not null,
  confidence_score numeric(4, 3), -- e.g., 0.852
  status public.candidate_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- PATIENT DIETARY INTAKE (CONFIRMED)
-- ==========================================

create table public.patient_dietary_intake (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  component_name text not null,
  consumed_at timestamptz not null default now(),
  provenance_candidate_id uuid references public.food_intake_candidates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ==========================================
-- TRIGGERS FOR TIMESTAMPS
-- ==========================================

create trigger update_uploaded_documents_modtime before update on public.uploaded_documents for each row execute function public.update_modified_column();
create trigger update_extraction_runs_modtime before update on public.extraction_runs for each row execute function public.update_modified_column();
create trigger update_food_intake_candidates_modtime before update on public.food_intake_candidates for each row execute function public.update_modified_column();
create trigger update_patient_dietary_intake_modtime before update on public.patient_dietary_intake for each row execute function public.update_modified_column();


-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

alter table public.uploaded_documents enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.food_intake_candidates enable row level security;
alter table public.patient_dietary_intake enable row level security;

-- uploaded_documents policies
create policy "Patients manage own uploaded documents"
  on public.uploaded_documents for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read connected uploaded documents"
  on public.uploaded_documents for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = uploaded_documents.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- extraction_runs policies
create policy "Patients manage own extraction runs"
  on public.extraction_runs for all
  using (
    exists (
      select 1 from public.uploaded_documents doc
      where doc.id = extraction_runs.document_id
      and doc.patient_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.uploaded_documents doc
      where doc.id = extraction_runs.document_id
      and doc.patient_id = auth.uid()
    )
  );

create policy "Professionals read connected extraction runs"
  on public.extraction_runs for select
  using (
    exists (
      select 1 from public.uploaded_documents doc
      join public.patient_professional_connections c on c.patient_id = doc.patient_id
      where doc.id = extraction_runs.document_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- food_intake_candidates policies
create policy "Patients manage own food intake candidates"
  on public.food_intake_candidates for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read connected food intake candidates"
  on public.food_intake_candidates for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = food_intake_candidates.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- patient_dietary_intake policies
create policy "Patients manage own dietary intake"
  on public.patient_dietary_intake for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "Professionals read connected dietary intake"
  on public.patient_dietary_intake for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = patient_dietary_intake.patient_id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

commit;
