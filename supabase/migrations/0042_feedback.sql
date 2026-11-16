-- ============================================================================
-- MTCC UAE — Season 1 feedback form
--
-- Anyone can submit feedback (no login). Only Super Admin / Tournament Admin
-- can read the answers. Also adds an optional "closes on" date to settings.
-- Safe to run: it only adds a table and a column.
-- ============================================================================

create table if not exists feedback_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  respondent_type text not null check (char_length(respondent_type) <= 60),
  team_name text check (char_length(team_name) <= 80),
  overall int not null check (overall between 1 and 5),
  rating_organisation int check (rating_organisation between 1 and 5),
  rating_ground int check (rating_ground between 1 and 5),
  rating_food int check (rating_food between 1 and 5),
  rating_umpiring int check (rating_umpiring between 1 and 5),
  rating_live_scores int check (rating_live_scores between 1 and 5),
  format_opinion text check (char_length(format_opinion) <= 40),
  auction_rating int check (auction_rating between 1 and 5),
  best_part text check (char_length(best_part) <= 1500),
  improve text check (char_length(improve) <= 1500),
  season2 text check (char_length(season2) <= 80),
  name text check (char_length(name) <= 100),
  phone text check (char_length(phone) <= 30)
);
create index if not exists feedback_responses_created_idx on feedback_responses (created_at desc);

alter table feedback_responses enable row level security;

drop policy if exists "feedback: anyone can submit" on feedback_responses;
create policy "feedback: anyone can submit" on feedback_responses
  for insert to anon, authenticated with check (true);

drop policy if exists "feedback: admins read" on feedback_responses;
create policy "feedback: admins read" on feedback_responses
  for select to authenticated using (has_role('Super Admin', 'Tournament Admin'));

drop policy if exists "feedback: super admin delete" on feedback_responses;
create policy "feedback: super admin delete" on feedback_responses
  for delete to authenticated using (has_role('Super Admin'));

grant insert on feedback_responses to anon, authenticated;
grant select, delete on feedback_responses to authenticated;

alter table tournament_settings add column if not exists feedback_closes_on date;
