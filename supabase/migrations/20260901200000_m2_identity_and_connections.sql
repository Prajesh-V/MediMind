begin;

create type public.professional_verification_status as enum ('pending', 'verified', 'rejected');
create type public.connection_status as enum ('pending', 'active', 'revoked');
create type public.audit_event_type as enum (
  'code_generation',
  'code_redemption',
  'connection_approval',
  'connection_revocation',
  'professional_verification_changed'
);

-- Profiles
create table public.patients (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professionals (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  credentials text not null,
  facility_name text,
  verification_status public.professional_verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Connections
create table public.patient_professional_connections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, professional_id)
);

-- Connection Codes (Hashed)
create table public.connection_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Audit Log (Server controlled)
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type public.audit_event_type not null,
  actor_id uuid references auth.users(id),
  target_id uuid, -- Contextual target (e.g. connection_id, professional_id)
  created_at timestamptz not null default now()
);

-- RLS setup (Deny by default)
alter table public.patients enable row level security;
alter table public.professionals enable row level security;
alter table public.patient_professional_connections enable row level security;
alter table public.connection_codes enable row level security;
alter table public.audit_log enable row level security;

-- ==========================================
-- POLICIES
-- ==========================================

-- Patients
create policy "Patients can insert own profile"
  on public.patients for insert with check (auth.uid() = id);

create policy "Patients read own profile"
  on public.patients for select using (auth.uid() = id);

create policy "Patients update own profile"
  on public.patients for update using (auth.uid() = id);

create policy "Professionals read active patient profiles"
  on public.patients for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = patients.id
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Professionals
create policy "Professionals can insert own profile"
  on public.professionals for insert with check (auth.uid() = id);

create policy "Professionals read own profile"
  on public.professionals for select using (auth.uid() = id);

create policy "Professionals update own profile"
  on public.professionals for update using (auth.uid() = id);

create policy "Patients read connected professional profiles"
  on public.professionals for select
  using (
    exists (
      select 1 from public.patient_professional_connections c
      where c.professional_id = professionals.id
      and c.patient_id = auth.uid()
    )
  );

-- Connections (READ ONLY for clients - Mutations via Security Definer RPC)
create policy "Patients read own connections"
  on public.patient_professional_connections for select using (auth.uid() = patient_id);

create policy "Professionals read own connections"
  on public.patient_professional_connections for select using (auth.uid() = professional_id);

-- Codes (READ ONLY for patients - Generation/Redemption via Security Definer RPC)
create policy "Patients read own codes"
  on public.connection_codes for select using (auth.uid() = patient_id);

-- Audit Log (READ ONLY for involved parties)
create policy "Read own audit logs"
  on public.audit_log for select using (auth.uid() = actor_id or auth.uid() = target_id);


-- ==========================================
-- SECURE FUNCTIONS (Lifecycle & Audit)
-- ==========================================

-- Trigger to update timestamps
create or replace function public.update_modified_column()
returns trigger language plpgsql security definer as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger update_patients_modtime before update on public.patients for each row execute function update_modified_column();
create trigger update_professionals_modtime before update on public.professionals for each row execute function update_modified_column();
create trigger update_connections_modtime before update on public.patient_professional_connections for each row execute function update_modified_column();


-- Generate Code
create or replace function public.generate_connection_code(p_code_hash text)
returns uuid
language plpgsql
security definer -- Elevate to bypass RLS for insert
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_code_id uuid;
begin
  v_patient_id := auth.uid();
  if v_patient_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Ensure patient exists
  if not exists (select 1 from public.patients where id = v_patient_id) then
    raise exception 'Patient profile not found';
  end if;

  insert into public.connection_codes (code_hash, patient_id, expires_at)
  values (p_code_hash, v_patient_id, now() + interval '15 minutes')
  returning id into v_code_id;

  insert into public.audit_log (event_type, actor_id, target_id)
  values ('code_generation', v_patient_id, v_code_id);

  return v_code_id;
end;
$$;


-- Redeem Code
create or replace function public.redeem_connection_code(p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional_id uuid;
  v_code_record record;
  v_connection_id uuid;
begin
  v_professional_id := auth.uid();
  if v_professional_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Verify it's a professional
  if not exists (select 1 from public.professionals where id = v_professional_id) then
    raise exception 'Professional profile required';
  end if;

  -- Lock the row to prevent race conditions (double redemption)
  select * into v_code_record
  from public.connection_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    raise exception 'Invalid code';
  end if;

  if v_code_record.redeemed_at is not null then
    raise exception 'Code already redeemed';
  end if;

  if v_code_record.expires_at < now() then
    raise exception 'Code expired';
  end if;

  -- Mark redeemed
  update public.connection_codes
  set redeemed_at = now()
  where id = v_code_record.id;

  -- Upsert connection as pending
  insert into public.patient_professional_connections (patient_id, professional_id, status)
  values (v_code_record.patient_id, v_professional_id, 'pending')
  on conflict (patient_id, professional_id) 
  do update set status = 'pending', updated_at = now()
  returning id into v_connection_id;

  -- Audit
  insert into public.audit_log (event_type, actor_id, target_id)
  values ('code_redemption', v_professional_id, v_connection_id);

  return v_connection_id;
end;
$$;


-- Approve Connection
create or replace function public.approve_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_conn record;
begin
  v_patient_id := auth.uid();

  select * into v_conn
  from public.patient_professional_connections
  where id = p_connection_id and patient_id = v_patient_id
  for update;

  if not found then
    raise exception 'Connection not found or unauthorized';
  end if;

  if v_conn.status <> 'pending' then
    raise exception 'Only pending connections can be approved';
  end if;

  update public.patient_professional_connections
  set status = 'active'
  where id = p_connection_id;

  insert into public.audit_log (event_type, actor_id, target_id)
  values ('connection_approval', v_patient_id, p_connection_id);
end;
$$;


-- Revoke Connection
create or replace function public.revoke_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_conn record;
begin
  v_patient_id := auth.uid();

  select * into v_conn
  from public.patient_professional_connections
  where id = p_connection_id and patient_id = v_patient_id
  for update;

  if not found then
    raise exception 'Connection not found or unauthorized';
  end if;

  update public.patient_professional_connections
  set status = 'revoked'
  where id = p_connection_id;

  insert into public.audit_log (event_type, actor_id, target_id)
  values ('connection_revocation', v_patient_id, p_connection_id);
end;
$$;

commit;
