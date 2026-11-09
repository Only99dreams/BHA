-- Allow owners to delete their own page versions (drafts/rejected)
drop policy if exists "Owners can delete their page versions" on public.page_versions;
create policy "Owners can delete their page versions" on public.page_versions
  for delete to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = auth.uid()
  ));
