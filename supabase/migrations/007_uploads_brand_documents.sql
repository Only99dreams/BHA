-- ============================================================================
-- BHA onboarding uploads, brand colour and verification documents.
--
-- Adds:
--   1. business_profiles.brand_color  (used by the AI page + public page theme)
--   2. public.business_documents      (metadata for uploaded verification files)
--   3. private "business-documents" storage bucket and public "business-media"
--   4. owner/admin storage policies scoped to the uploader's folder
--
-- Upload paths are ALWAYS  <auth.uid()>/<business_id|pending>/<file>
-- so a signed-in user can only read/write their own folder while admins can
-- review everything. Documents stay private; logos/covers are public.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Brand colour on the business profile
-- ----------------------------------------------------------------------------
alter table public.business_profiles
  add column if not exists brand_color text;

-- Helpers are recreated so this migration is safe even if 006 was skipped.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('ADMIN', 'REVIEWER')
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Verification documents
-- ----------------------------------------------------------------------------
create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_documents_business_idx
  on public.business_documents (business_id, created_at desc);

drop trigger if exists business_documents_touch_updated_at on public.business_documents;
create trigger business_documents_touch_updated_at
  before update on public.business_documents
  for each row execute function public.touch_updated_at();

alter table public.business_documents enable row level security;

drop policy if exists "Owners can view their business documents" on public.business_documents;
create policy "Owners can view their business documents" on public.business_documents
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can add their business documents" on public.business_documents;
create policy "Owners can add their business documents" on public.business_documents
  for insert to authenticated
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can update their business documents" on public.business_documents;
create policy "Owners can update their business documents" on public.business_documents
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Owners can delete their business documents" on public.business_documents;
create policy "Owners can delete their business documents" on public.business_documents
  for delete to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "Admins can manage business documents" on public.business_documents;
create policy "Admins can manage business documents" on public.business_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Storage buckets
--    business-media     : public (logos/covers rendered on public pages)
--    business-documents : private (only owner + admins, via signed URLs)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'business-media',
    'business-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  ),
  (
    'business-documents',
    'business-documents',
    false,
    20971520,
    array[
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public media can be read by anyone (the bucket is public).
drop policy if exists "Public can read business media" on storage.objects;
create policy "Public can read business media" on storage.objects
  for select using (bucket_id = 'business-media');

-- Owners write only inside their own <uid>/ folder.
drop policy if exists "Owners can upload business media" on storage.objects;
create policy "Owners can upload business media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can update business media" on storage.objects;
create policy "Owners can update business media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can delete business media" on storage.objects;
create policy "Owners can delete business media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins can manage business media" on storage.objects;
create policy "Admins can manage business media" on storage.objects
  for all to authenticated
  using (bucket_id = 'business-media' and public.is_admin())
  with check (bucket_id = 'business-media' and public.is_admin());

-- Private documents: owner folder + admins only.
drop policy if exists "Owners can read business documents" on storage.objects;
create policy "Owners can read business documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Owners can upload business documents" on storage.objects;
create policy "Owners can upload business documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can update business documents" on storage.objects;
create policy "Owners can update business documents" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can delete business documents" on storage.objects;
create policy "Owners can delete business documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins can manage business documents" on storage.objects;
create policy "Admins can manage business documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'business-documents' and public.is_admin())
  with check (bucket_id = 'business-documents' and public.is_admin());
