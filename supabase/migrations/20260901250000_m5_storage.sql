begin;

-- ==========================================
-- SUPABASE STORAGE BUCKET
-- ==========================================

insert into storage.buckets (id, name, public)
values ('multimodal_uploads', 'multimodal_uploads', false)
on conflict (id) do nothing;

-- ==========================================
-- STORAGE ROW LEVEL SECURITY
-- ==========================================

-- Allow patients to upload their own files
create policy "Patients can upload their own files"
  on storage.objects for insert
  with check (
    bucket_id = 'multimodal_uploads' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Allow patients to read their own files
create policy "Patients can read their own files"
  on storage.objects for select
  using (
    bucket_id = 'multimodal_uploads' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Allow active connected professionals to read a patient's files
create policy "Connected professionals can read patient files"
  on storage.objects for select
  using (
    bucket_id = 'multimodal_uploads' and
    exists (
      select 1 from public.patient_professional_connections c
      where c.patient_id = (storage.foldername(name))[1]::uuid
      and c.professional_id = auth.uid()
      and c.status = 'active'
    )
  );

-- Allow patients to delete their own files
create policy "Patients can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'multimodal_uploads' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

commit;
