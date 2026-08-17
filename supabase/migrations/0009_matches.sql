-- ============================================================================
-- MTCC UAE — Matches (Fixtures & Standings)
--
-- V1 scope: admin/scorer enter the match schedule and final results after
-- each match (not live ball-by-ball scoring — that's a larger future
-- module). This is enough to power a public Fixtures list and a computed
-- Points Table.
-- ============================================================================

create table matches (
  id uuid primary key default gen_random_uuid(),
  match_number int,
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  match_date date,
  match_time time,
  ground text,
  group_name text,
  stage text not null default 'League', -- League, Quarter-Final, Semi-Final, Final
  status text not null default 'Scheduled', -- Scheduled, Live, Completed, Abandoned
  toss_winner_id uuid references teams(id) on delete set null,
  batting_first_id uuid references teams(id) on delete set null,
  team_a_score text,
  team_a_overs numeric,
  team_b_score text,
  team_b_overs numeric,
  winner_id uuid references teams(id) on delete set null,
  is_tie boolean not null default false,
  margin text,
  man_of_match text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index matches_status_idx on matches (status);
create index matches_match_date_idx on matches (match_date);

create trigger matches_set_updated_at before update on matches
  for each row execute function set_updated_at();

alter table matches enable row level security;

create policy "matches: readable by anyone"
  on matches for select using (true);

create policy "matches: managed by Super Admin / Tournament Admin / Scorer"
  on matches for all
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));

-- Safe public view for match listings — no change needed here since matches
-- never held sensitive data, but kept consistent with the pattern used for
-- players/teams so future columns default to being reviewed before public
-- exposure.
create view match_public as
  select id, match_number, team_a_id, team_b_id, match_date, match_time, ground,
         group_name, stage, status, toss_winner_id, batting_first_id,
         team_a_score, team_a_overs, team_b_score, team_b_overs,
         winner_id, is_tie, margin, man_of_match
  from matches;

grant select on match_public to anon, authenticated;
