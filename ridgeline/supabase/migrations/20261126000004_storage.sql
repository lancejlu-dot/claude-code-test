-- =============================================================================
-- Storage buckets and policies (Supabase Storage). Skipped automatically when
-- the storage schema is absent (e.g. plain-Postgres test runs).
-- =============================================================================
do $outer$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'storage schema not found; skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('event-media', 'event-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif']),
    ('avatars', 'avatars', true, 3145728, array['image/jpeg','image/png','image/webp']),
    ('private-records', 'private-records', false, 20971520, null)
  on conflict (id) do nothing;

  -- Event media: staff upload, everyone reads (bucket is public).
  execute $p$create policy "event media staff write" on storage.objects for insert to authenticated
    with check (bucket_id = 'event-media' and public.is_staff())$p$;
  execute $p$create policy "event media staff update" on storage.objects for update to authenticated
    using (bucket_id = 'event-media' and public.is_staff())$p$;
  execute $p$create policy "event media staff delete" on storage.objects for delete to authenticated
    using (bucket_id = 'event-media' and public.is_staff())$p$;

  -- Avatars: members manage files under their own user-id folder.
  execute $p$create policy "avatar own write" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "avatar own update" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "avatar own delete" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  -- Private records: administrators only (served through short-lived signed URLs).
  execute $p$create policy "private records admin" on storage.objects for all to authenticated
    using (bucket_id = 'private-records' and public.is_admin())
    with check (bucket_id = 'private-records' and public.is_admin())$p$;
end
$outer$;
