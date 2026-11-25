-- Season 1 gallery: photos (stored compressed in the public 'gallery' bucket) and
-- videos (YouTube / Instagram links only, nothing heavy is hosted).

create table if not exists gallery_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo', 'video')),
  category text not null default 'Other',
  title text,
  path text,            -- storage path of the full-size (<=1600px) photo
  thumb_path text,      -- storage path of the small grid preview
  width int,
  height int,
  video_url text,
  video_id text,        -- YouTube id when embeddable
  featured boolean not null default false,
  hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gallery_items_created_idx on gallery_items (created_at desc);

alter table gallery_items enable row level security;

create policy "gallery: visible items readable by anyone"
  on gallery_items for select using (not hidden);

create policy "gallery: admins read all"
  on gallery_items for select using (has_role('Super Admin', 'Tournament Admin'));

create policy "gallery: admins manage"
  on gallery_items for all
  using (has_role('Super Admin', 'Tournament Admin'))
  with check (has_role('Super Admin', 'Tournament Admin'));

grant select on gallery_items to anon, authenticated;
grant insert, update, delete on gallery_items to authenticated;

-- Public bucket, JPEG only, 2 MB cap per file (the admin page compresses before upload).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "gallery: public read"
  on storage.objects for select using (bucket_id = 'gallery');

create policy "gallery: privileged roles can upload"
  on storage.objects for insert
  with check (bucket_id = 'gallery' and has_role('Super Admin', 'Tournament Admin'));

create policy "gallery: privileged roles can replace"
  on storage.objects for update
  using (bucket_id = 'gallery' and has_role('Super Admin', 'Tournament Admin'));

create policy "gallery: privileged roles can delete"
  on storage.objects for delete
  using (bucket_id = 'gallery' and has_role('Super Admin', 'Tournament Admin'));
