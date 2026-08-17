-- ============================================================================
-- MTCC UAE — Ball-by-ball scoring (innings + balls)
--
-- Standard cricket scoring per the Laws of Cricket / ICC playing conditions:
-- legal deliveries vs extras (wide/no-ball don't count as a ball faced or
-- toward the over; bye/leg-bye do), the 10 recognised dismissal modes, free
-- hits after a no-ball, strike rotation on odd runs, and a new bowler
-- required each over. See src/lib/scoring.ts for the computation logic.
--
-- V1 scope note: no DRS, no maiden-over/partnership tracking display yet,
-- and Retired Hurt is treated as ending the innings for that batter (the
-- "return later" nuance isn't modelled) — flagged honestly to the user.
-- ============================================================================

create table innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  innings_number int not null check (innings_number in (1, 2)),
  batting_team_id uuid references teams(id),
  bowling_team_id uuid references teams(id),

  opening_striker_id uuid references players(id),
  opening_non_striker_id uuid references players(id),
  opening_bowler_id uuid references players(id),

  total_runs int not null default 0,
  total_wickets int not null default 0,
  legal_balls int not null default 0, -- completed legal deliveries; over = legal_balls/6

  extras_wide int not null default 0,
  extras_no_ball int not null default 0,
  extras_bye int not null default 0,
  extras_leg_bye int not null default 0,
  extras_penalty int not null default 0,

  current_striker_id uuid references players(id),
  current_non_striker_id uuid references players(id),
  current_bowler_id uuid references players(id),
  last_over_bowler_id uuid references players(id),
  is_free_hit boolean not null default false,

  target int, -- set on innings 2 = innings 1 total + 1
  status text not null default 'In Progress', -- In Progress, Completed

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, innings_number)
);

create table balls (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  sequence_no int not null, -- chronological order within the innings (for undo/replay)
  over_number int not null, -- 0-indexed
  ball_in_over int not null, -- 1-6 for legal deliveries; repeats for extras in the same over

  striker_id uuid references players(id),
  non_striker_id uuid references players(id),
  bowler_id uuid references players(id),

  runs_off_bat int not null default 0,
  extra_type text, -- null, 'wide', 'no_ball', 'bye', 'leg_bye', 'penalty'
  extra_runs int not null default 0,

  is_wicket boolean not null default false,
  wicket_type text, -- Bowled, Caught, LBW, Run Out, Stumped, Hit Wicket, Obstructing The Field, Timed Out, Handled The Ball, Hit The Ball Twice, Retired Out, Retired Hurt
  dismissed_player_id uuid references players(id),
  fielder_id uuid references players(id),
  new_batsman_id uuid references players(id), -- who replaced the dismissed batter, if any

  is_free_hit boolean not null default false,
  notes text,

  created_at timestamptz not null default now()
);

create index balls_innings_seq_idx on balls (innings_id, sequence_no);

create trigger innings_set_updated_at before update on innings
  for each row execute function set_updated_at();

alter table innings enable row level security;
alter table balls enable row level security;

create policy "innings: readable by anyone" on innings for select using (true);
create policy "innings: managed by Super Admin / Tournament Admin / Scorer" on innings for all
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));

create policy "balls: readable by anyone" on balls for select using (true);
create policy "balls: managed by Super Admin / Tournament Admin / Scorer" on balls for all
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));

-- Realtime for live scoring — same requirement as the auction tables.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'innings') then
    alter publication supabase_realtime add table innings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'balls') then
    alter publication supabase_realtime add table balls;
  end if;
end $$;
