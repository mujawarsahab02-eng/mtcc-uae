-- ============================================================================
-- MTCC UAE — Sponsors + "Powered By" credit
-- ============================================================================

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  website_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table sponsors enable row level security;

create policy "sponsors: readable by anyone"
  on sponsors for select using (true);

create policy "sponsors: managed by Super Admin / Tournament Admin"
  on sponsors for all
  using (has_role('Super Admin', 'Tournament Admin'))
  with check (has_role('Super Admin', 'Tournament Admin'));

alter table tournament_settings
  add column if not exists powered_by_name text default '',
  add column if not exists powered_by_logo_path text default '';

-- sponsor-logos: public bucket, same pattern as player-photos/team-logos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('sponsor-logos', 'sponsor-logos', true, 5242880)
on conflict (id) do nothing;

create policy "sponsor-logos: public read"
  on storage.objects for select
  using (bucket_id = 'sponsor-logos');

create policy "sponsor-logos: privileged roles can upload"
  on storage.objects for insert
  with check (bucket_id = 'sponsor-logos' and has_role('Super Admin', 'Tournament Admin'));

create policy "sponsor-logos: privileged roles can replace"
  on storage.objects for update
  using (bucket_id = 'sponsor-logos' and has_role('Super Admin', 'Tournament Admin'));

create policy "sponsor-logos: privileged roles can delete"
  on storage.objects for delete
  using (bucket_id = 'sponsor-logos' and has_role('Super Admin', 'Tournament Admin'));
