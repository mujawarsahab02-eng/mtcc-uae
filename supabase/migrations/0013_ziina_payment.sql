-- ============================================================================
-- MTCC UAE — Ziina QR payment scanner image
--
-- Same public-bucket pattern as sponsor-logos/team-logos. The image is
-- shown to players on the registration page when they select "Ziina" as
-- their payment method.
-- ============================================================================

alter table tournament_settings
  add column if not exists ziina_qr_path text default '';

insert into storage.buckets (id, name, public, file_size_limit)
values ('payment-assets', 'payment-assets', true, 5242880)
on conflict (id) do nothing;

create policy "payment-assets: public read"
  on storage.objects for select
  using (bucket_id = 'payment-assets');

create policy "payment-assets: privileged roles can upload"
  on storage.objects for insert
  with check (bucket_id = 'payment-assets' and has_role('Super Admin', 'Tournament Admin'));

create policy "payment-assets: privileged roles can replace"
  on storage.objects for update
  using (bucket_id = 'payment-assets' and has_role('Super Admin', 'Tournament Admin'));

create policy "payment-assets: privileged roles can delete"
  on storage.objects for delete
  using (bucket_id = 'payment-assets' and has_role('Super Admin', 'Tournament Admin'));
