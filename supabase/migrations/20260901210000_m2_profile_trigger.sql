-- ==========================================
-- M2: PROFILE CREATION TRIGGER
-- ==========================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_first_name text;
  v_last_name text;
begin
  v_role := new.raw_user_meta_data->>'role';
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';

  -- Only attempt to insert if role is specified
  if v_role = 'patient' then
    insert into public.patients (id, first_name, last_name)
    values (
      new.id, 
      coalesce(nullif(trim(v_first_name), ''), 'Patient'),
      coalesce(nullif(trim(v_last_name), ''), 'User')
    );
  elsif v_role = 'professional' then
    insert into public.professionals (id, first_name, last_name, credentials, verification_status)
    values (
      new.id, 
      coalesce(nullif(trim(v_first_name), ''), 'Dr. Professional'),
      coalesce(nullif(trim(v_last_name), ''), ''),
      'MD',
      'pending'
    );
  end if;

  return new;
exception when others then
  -- In case of failure, raise a visible exception rather than silently ignoring
  raise exception 'Profile creation failed for user %: %', new.id, sqlerrm;
end;
$$;

-- Drop trigger if it exists (for idempotency)
drop trigger if exists on_auth_user_created on auth.users;

-- Create the trigger on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
