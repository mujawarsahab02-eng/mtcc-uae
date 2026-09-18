-- ============================================================================
-- MTCC UAE — Live Scoring (Phase 1: database)
--
-- Ball-by-ball scoring with automatically rebuilt scorecards. Every change to
-- the balls table (new ball, undo, correction) recomputes that innings'
-- totals, batting card and bowling card, so the numbers can never drift.
-- Matches scored in 'Manual' mode skip the recompute and keep hand-entered
-- scorecards instead.
-- ============================================================================

-- 1. Extra match settings --------------------------------------------------
alter table matches add column if not exists overs_per_innings int;
alter table matches add column if not exists max_overs_per_bowler int;
alter table matches add column if not exists toss_decision text;           -- 'Bat' / 'Bowl'
alter table matches add column if not exists scoring_mode text not null default 'Live'; -- 'Live' / 'Manual'
alter table matches add column if not exists result_type text;             -- 'Normal', 'Tie', 'Super Over', 'No Result'
alter table matches add column if not exists man_of_match_player_id uuid references players(id) on delete set null;
alter table matches add column if not exists cricheroes_url text;

-- 2. Playing XI ---------------------------------------------------------------
create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  is_captain boolean not null default false,
  is_wicket_keeper boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index if not exists match_players_match_idx on match_players (match_id);

-- 3. Innings (live state + running totals) -----------------------------------
create table if not exists innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  innings_number int not null,                    -- 1, 2 (3, 4 = super over)
  is_super_over boolean not null default false,
  batting_team_id uuid references teams(id) on delete set null,
  bowling_team_id uuid references teams(id) on delete set null,
  overs_limit int,
  target int,
  status text not null default 'In Progress',     -- 'In Progress' / 'Completed'
  total_runs int not null default 0,
  wickets int not null default 0,
  legal_balls int not null default 0,
  wides int not null default 0,
  no_balls int not null default 0,
  byes int not null default 0,
  leg_byes int not null default 0,
  striker_id uuid references players(id) on delete set null,
  non_striker_id uuid references players(id) on delete set null,
  current_bowler_id uuid references players(id) on delete set null,
  free_hit_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, innings_number)
);
drop trigger if exists innings_set_updated_at on innings;
create trigger innings_set_updated_at before update on innings
  for each row execute function set_updated_at();

-- 4. Balls (one row per delivery, plus events like Retired Hurt) -------------
create table if not exists balls (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  seq int not null,                               -- order within the innings
  over_number int not null,                       -- 0-based (first over = 0)
  ball_in_over int not null,                      -- legal balls in this over after this delivery
  is_delivery boolean not null default true,      -- false for non-ball events (Retired Hurt)
  batter_id uuid references players(id) on delete set null,
  non_striker_id uuid references players(id) on delete set null,
  bowler_id uuid references players(id) on delete set null,
  runs_bat int not null default 0,
  is_boundary boolean not null default false,
  extra_type text,                                -- null / 'Wide' / 'No Ball' / 'Bye' / 'Leg Bye'
  extra_runs int not null default 0,
  is_legal boolean not null default true,
  is_free_hit boolean not null default false,
  is_wicket boolean not null default false,
  dismissal_type text,                            -- 'Bowled','Caught','Caught & Bowled','LBW','Stumped','Run Out','Hit Wicket','Retired Hurt','Retired Out'
  dismissed_player_id uuid references players(id) on delete set null,
  fielder_id uuid references players(id) on delete set null,
  shot_x numeric,                                 -- wagon wheel, 0..1 (optional)
  shot_y numeric,
  commentary text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (innings_id, seq)
);
create index if not exists balls_match_idx on balls (match_id);

-- 5. Scorecards (rebuilt automatically in Live mode, typed in for Manual) ----
create table if not exists batting_cards (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  player_id uuid not null references players(id) on delete cascade,
  batting_position int,
  runs int not null default 0,
  balls int not null default 0,
  fours int not null default 0,
  sixes int not null default 0,
  is_out boolean not null default false,
  dismissal_type text,
  bowler_id uuid references players(id) on delete set null,
  fielder_id uuid references players(id) on delete set null,
  unique (innings_id, player_id)
);
create index if not exists batting_cards_player_idx on batting_cards (player_id);

create table if not exists bowling_cards (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  player_id uuid not null references players(id) on delete cascade,
  bowling_order int,
  legal_balls int not null default 0,
  runs_conceded int not null default 0,
  wickets int not null default 0,
  maidens int not null default 0,
  wides int not null default 0,
  no_balls int not null default 0,
  dots int not null default 0,
  fours_conceded int not null default 0,
  sixes_conceded int not null default 0,
  unique (innings_id, player_id)
);
create index if not exists bowling_cards_player_idx on bowling_cards (player_id);

-- 6. Recompute an innings from its balls --------------------------------------
create or replace function recompute_innings(p_innings_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match_id uuid;
  v_bat_team uuid;
  v_bowl_team uuid;
  v_mode text;
begin
  select i.match_id, i.batting_team_id, i.bowling_team_id, m.scoring_mode
    into v_match_id, v_bat_team, v_bowl_team, v_mode
  from innings i
  join matches m on m.id = i.match_id
  where i.id = p_innings_id;

  if v_match_id is null or v_mode = 'Manual' then
    return;
  end if;

  -- Innings totals
  update innings set
    total_runs  = s.r,
    wickets     = s.w,
    legal_balls = s.lb,
    wides       = s.wd,
    no_balls    = s.nb,
    byes        = s.by,
    leg_byes    = s.lby
  from (
    select coalesce(sum(b.runs_bat + b.extra_runs), 0)                          as r,
           count(*) filter (where b.is_wicket)                                   as w,
           count(*) filter (where b.is_delivery and b.is_legal)                  as lb,
           coalesce(sum(b.extra_runs) filter (where b.extra_type = 'Wide'), 0)    as wd,
           coalesce(sum(b.extra_runs) filter (where b.extra_type = 'No Ball'), 0) as nb,
           coalesce(sum(b.extra_runs) filter (where b.extra_type = 'Bye'), 0)     as by,
           coalesce(sum(b.extra_runs) filter (where b.extra_type = 'Leg Bye'), 0) as lby
    from balls b
    where b.innings_id = p_innings_id
  ) s
  where innings.id = p_innings_id;

  -- Batting card
  delete from batting_cards where innings_id = p_innings_id;

  with appearances as (
    select b.batter_id as pid, b.seq * 2 as k
    from balls b where b.innings_id = p_innings_id and b.batter_id is not null
    union all
    select b.non_striker_id, b.seq * 2 + 1
    from balls b where b.innings_id = p_innings_id and b.non_striker_id is not null
  ),
  firsts as (
    select pid, min(k) as first_k from appearances group by pid
  ),
  bat as (
    select b.batter_id as pid,
           sum(b.runs_bat) as n_runs,
           count(*) filter (where b.extra_type is distinct from 'Wide') as n_balls,
           count(*) filter (where b.is_boundary and b.runs_bat = 4) as n_fours,
           count(*) filter (where b.is_boundary and b.runs_bat = 6) as n_sixes
    from balls b
    where b.innings_id = p_innings_id and b.batter_id is not null and b.is_delivery
    group by b.batter_id
  ),
  outs as (
    select distinct on (b.dismissed_player_id)
           b.dismissed_player_id as pid, b.dismissal_type, b.bowler_id, b.fielder_id, b.is_wicket
    from balls b
    where b.innings_id = p_innings_id and b.dismissed_player_id is not null
    order by b.dismissed_player_id, b.seq desc
  )
  insert into batting_cards (innings_id, match_id, team_id, player_id, batting_position,
                             runs, balls, fours, sixes, is_out, dismissal_type, bowler_id, fielder_id)
  select p_innings_id, v_match_id, v_bat_team, f.pid,
         row_number() over (order by f.first_k),
         coalesce(bt.n_runs, 0), coalesce(bt.n_balls, 0), coalesce(bt.n_fours, 0), coalesce(bt.n_sixes, 0),
         coalesce(o.is_wicket, false),
         o.dismissal_type,
         case when o.dismissal_type in ('Bowled','Caught','Caught & Bowled','LBW','Stumped','Hit Wicket')
              then o.bowler_id end,
         o.fielder_id
  from firsts f
  left join bat bt on bt.pid = f.pid
  left join outs o on o.pid = f.pid;

  -- Bowling card
  delete from bowling_cards where innings_id = p_innings_id;

  with deliveries as (
    select b.bowler_id, b.seq, b.over_number, b.is_legal, b.is_wicket, b.dismissal_type,
           b.extra_type, b.is_boundary, b.runs_bat,
           b.runs_bat + case when b.extra_type in ('Wide','No Ball') then b.extra_runs else 0 end as bowler_runs
    from balls b
    where b.innings_id = p_innings_id and b.is_delivery and b.bowler_id is not null
  ),
  per_over as (
    select bowler_id, over_number,
           count(*) filter (where is_legal) as lb,
           sum(bowler_runs) as r
    from deliveries
    group by bowler_id, over_number
  ),
  maiden_count as (
    select bowler_id, count(*) as n from per_over where lb = 6 and r = 0 group by bowler_id
  ),
  agg as (
    select bowler_id,
           min(seq) as first_seq,
           count(*) filter (where is_legal) as n_legal,
           sum(bowler_runs) as n_runs,
           count(*) filter (where is_wicket and dismissal_type in
                            ('Bowled','Caught','Caught & Bowled','LBW','Stumped','Hit Wicket')) as n_wkts,
           count(*) filter (where extra_type = 'Wide') as n_wd,
           count(*) filter (where extra_type = 'No Ball') as n_nb,
           count(*) filter (where is_legal and bowler_runs = 0) as n_dots,
           count(*) filter (where is_boundary and runs_bat = 4) as n_4,
           count(*) filter (where is_boundary and runs_bat = 6) as n_6
    from deliveries
    group by bowler_id
  )
  insert into bowling_cards (innings_id, match_id, team_id, player_id, bowling_order, legal_balls,
                             runs_conceded, wickets, maidens, wides, no_balls, dots,
                             fours_conceded, sixes_conceded)
  select p_innings_id, v_match_id, v_bowl_team, a.bowler_id,
         row_number() over (order by a.first_seq),
         a.n_legal, a.n_runs, a.n_wkts, coalesce(mc.n, 0), a.n_wd, a.n_nb, a.n_dots, a.n_4, a.n_6
  from agg a
  left join maiden_count mc on mc.bowler_id = a.bowler_id;
end;
$$;

create or replace function balls_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_innings(old.innings_id);
    return old;
  end if;
  perform recompute_innings(new.innings_id);
  if tg_op = 'UPDATE' and old.innings_id <> new.innings_id then
    perform recompute_innings(old.innings_id);
  end if;
  return new;
end;
$$;

drop trigger if exists balls_recompute on balls;
create trigger balls_recompute after insert or update or delete on balls
  for each row execute function balls_after_change();

-- 7. Security: anyone can view, only Super Admin / Tournament Admin / Scorer edit
do $$
declare
  t text;
begin
  foreach t in array array['match_players','innings','balls','batting_cards','bowling_cards'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || ': readable by anyone', t);
    execute format('create policy %I on %I for select using (true)', t || ': readable by anyone', t);
    execute format('drop policy if exists %I on %I', t || ': managed by scorers', t);
    execute format(
      $f$create policy %I on %I for all
         using (has_role('Super Admin','Tournament Admin','Scorer'))
         with check (has_role('Super Admin','Tournament Admin','Scorer'))$f$,
      t || ': managed by scorers', t);
  end loop;
end $$;

-- 8. Tournament stats (super overs excluded) ---------------------------------
create or replace view player_batting_stats as
select bc.player_id, p.full_name, p.photo_path, bc.team_id,
       count(distinct bc.match_id) as matches,
       count(*) as innings,
       sum(bc.runs) as runs,
       sum(bc.balls) as balls,
       count(*) filter (where not bc.is_out) as not_outs,
       max(bc.runs) as highest,
       sum(bc.fours) as fours,
       sum(bc.sixes) as sixes,
       count(*) filter (where bc.runs >= 25 and bc.runs < 50) as twenty_fives,
       count(*) filter (where bc.runs >= 50) as fifties,
       round(sum(bc.runs)::numeric / nullif(count(*) filter (where bc.is_out), 0), 2) as average,
       round(sum(bc.runs)::numeric * 100 / nullif(sum(bc.balls), 0), 2) as strike_rate
from batting_cards bc
join innings i on i.id = bc.innings_id and not i.is_super_over
join players p on p.id = bc.player_id
group by bc.player_id, p.full_name, p.photo_path, bc.team_id;

create or replace view player_bowling_stats as
with cards as (
  select bc.*
  from bowling_cards bc
  join innings i on i.id = bc.innings_id and not i.is_super_over
),
best as (
  select distinct on (player_id) player_id, wickets as best_wickets, runs_conceded as best_runs
  from cards
  order by player_id, wickets desc, runs_conceded asc
)
select c.player_id, p.full_name, p.photo_path, c.team_id,
       count(distinct c.match_id) as matches,
       sum(c.legal_balls) as balls,
       (sum(c.legal_balls) / 6)::text || '.' || (sum(c.legal_balls) % 6)::text as overs,
       sum(c.runs_conceded) as runs,
       sum(c.wickets) as wickets,
       sum(c.maidens) as maidens,
       sum(c.dots) as dots,
       sum(c.wides) as wides,
       sum(c.no_balls) as no_balls,
       round(sum(c.runs_conceded)::numeric * 6 / nullif(sum(c.legal_balls), 0), 2) as economy,
       round(sum(c.runs_conceded)::numeric / nullif(sum(c.wickets), 0), 2) as average,
       round(sum(c.legal_balls)::numeric / nullif(sum(c.wickets), 0), 2) as strike_rate,
       b.best_wickets, b.best_runs
from cards c
join players p on p.id = c.player_id
left join best b on b.player_id = c.player_id
group by c.player_id, p.full_name, p.photo_path, c.team_id, b.best_wickets, b.best_runs;

create or replace view player_fielding_stats as
select bc.fielder_id as player_id, p.full_name, p.photo_path,
       count(*) filter (where bc.dismissal_type in ('Caught','Caught & Bowled')) as catches,
       count(*) filter (where bc.dismissal_type = 'Run Out') as run_outs,
       count(*) filter (where bc.dismissal_type = 'Stumped') as stumpings
from batting_cards bc
join innings i on i.id = bc.innings_id and not i.is_super_over
join players p on p.id = bc.fielder_id
where bc.fielder_id is not null
group by bc.fielder_id, p.full_name, p.photo_path;

grant select on player_batting_stats, player_bowling_stats, player_fielding_stats to anon, authenticated;

notify pgrst, 'reload schema';
