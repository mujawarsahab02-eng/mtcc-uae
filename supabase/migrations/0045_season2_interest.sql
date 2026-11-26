-- Season 2 interest: anyone can register interest (no login); only Super Admin /
-- Tournament Admin can read the list. Safe to run: it only adds a table.
create table if not exists season2_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) between 5 and 30),
  interest text not null check (char_length(interest) <= 60),
  organisation text check (char_length(organisation) <= 120),
  message text check (char_length(message) <= 1000)
);
create index if not exists season2_interest_created_idx on season2_interest (created_at desc);

alter table season2_interest enable row level security;

drop policy if exists "season2: anyone can register" on season2_interest;
create policy "season2: anyone can register" on season2_interest
  for insert to anon, authenticated with check (true);

drop policy if exists "season2: admins read" on season2_interest;
create policy "season2: admins read" on season2_interest
  for select to authenticated using (has_role('Super Admin', 'Tournament Admin'));

drop policy if exists "season2: super admin delete" on season2_interest;
create policy "season2: super admin delete" on season2_interest
  for delete to authenticated using (has_role('Super Admin'));

grant insert on season2_interest to anon, authenticated;
grant select, delete on season2_interest to authenticated;
