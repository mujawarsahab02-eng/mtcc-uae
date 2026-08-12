-- ============================================================================
-- MTCC UAE — Storage buckets
--
-- player-photos, team-logos : PUBLIC (needed on the display screen / squad
--                              cards; nothing sensitive lives here)
-- emirates-ids, payment-receipts, tournament-documents : PRIVATE — only
--   accessible via short-lived signed URLs generated server-side for
--   Super Admin / Tournament Admin / Finance Admin (see
--   src/app/api/documents/sign/route.ts). Never exposed publicly.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('player-photos', 'player-photos', true, 5242880),
  ('team-logos', 'team-logos', true, 5242880),
  ('emirates-ids', 'emirates-ids', false, 10485760),
  ('payment-receipts', 'payment-receipts', false, 10485760),
  ('tournament-documents', 'tournament-documents', false, 20971520)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- player-photos (public bucket)
-- ---------------------------------------------------------------------------
create policy "player-photos: public read"
  on storage.objects for select
  using (bucket_id = 'player-photos');

create policy "player-photos: anyone can upload during registration"
  on storage.objects for insert
  with check (bucket_id = 'player-photos');

create policy "player-photos: privileged roles can replace/delete"
  on storage.objects for update
  using (bucket_id = 'player-photos' and has_role('Super Admin', 'Tournament Admin'));

create policy "player-photos: privileged roles can delete"
  on storage.objects for delete
  using (bucket_id = 'player-photos' and has_role('Super Admin', 'Tournament Admin'));

-- ---------------------------------------------------------------------------
-- team-logos (public bucket)
-- ---------------------------------------------------------------------------
create policy "team-logos: public read"
  on storage.objects for select
  using (bucket_id = 'team-logos');

create policy "team-logos: privileged roles can upload"
  on storage.objects for insert
  with check (bucket_id = 'team-logos' and has_role('Super Admin', 'Tournament Admin'));

create policy "team-logos: privileged roles can replace/delete"
  on storage.objects for update
  using (bucket_id = 'team-logos' and has_role('Super Admin', 'Tournament Admin'));

create policy "team-logos: privileged roles can delete objects"
  on storage.objects for delete
  using (bucket_id = 'team-logos' and has_role('Super Admin', 'Tournament Admin'));

-- ---------------------------------------------------------------------------
-- emirates-ids (private bucket)
-- ---------------------------------------------------------------------------
create policy "emirates-ids: anyone can upload during registration"
  on storage.objects for insert
  with check (bucket_id = 'emirates-ids');

create policy "emirates-ids: only document-access roles can read"
  on storage.objects for select
  using (bucket_id = 'emirates-ids' and has_document_access());

create policy "emirates-ids: only document-access roles can delete"
  on storage.objects for delete
  using (bucket_id = 'emirates-ids' and has_document_access());

-- ---------------------------------------------------------------------------
-- payment-receipts (private bucket)
-- ---------------------------------------------------------------------------
create policy "payment-receipts: anyone can upload during registration/payment"
  on storage.objects for insert
  with check (bucket_id = 'payment-receipts');

create policy "payment-receipts: only document-access roles can read"
  on storage.objects for select
  using (bucket_id = 'payment-receipts' and has_document_access());

create policy "payment-receipts: only document-access roles can delete"
  on storage.objects for delete
  using (bucket_id = 'payment-receipts' and has_document_access());

-- ---------------------------------------------------------------------------
-- tournament-documents (private bucket) — rules PDFs, sponsorship decks, etc.
-- Admin-only end to end, no public registration path writes here.
-- ---------------------------------------------------------------------------
create policy "tournament-documents: privileged roles can read"
  on storage.objects for select
  using (bucket_id = 'tournament-documents' and has_role('Super Admin', 'Tournament Admin', 'Finance Admin'));

create policy "tournament-documents: privileged roles can upload"
  on storage.objects for insert
  with check (bucket_id = 'tournament-documents' and has_role('Super Admin', 'Tournament Admin'));

create policy "tournament-documents: privileged roles can delete"
  on storage.objects for delete
  using (bucket_id = 'tournament-documents' and has_role('Super Admin', 'Tournament Admin'));
