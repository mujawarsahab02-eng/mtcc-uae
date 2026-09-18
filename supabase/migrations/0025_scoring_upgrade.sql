-- ============================================================================
-- MTCC UAE — Scoring upgrade (builds on 0010_scoring)
--
-- Keeps the existing innings/balls tables and scorer. Adds per-match settings,
-- Playing XI, super overs, commentary/wagon-wheel fields, and scorecard tables
-- that rebuild automatically whenever a ball is added, undone or corrected.
-- Matches in 'Manual' scoring mode keep hand-entered scorecards instead.
-- ============================================================================

-- 1. Per-match settings -------------------------------------------------------
alter table matches add column if not exists overs_per_innings int;
alter table matches add column if not exists max_overs_per_bowler int;
alter table matches add column if not exists toss_decision text;            -- 'Bat' / 'Bowl'
alter table matches add column if not exists scoring_mode text not null default 'Live'; -- 'Live' / 'Manual'
alter table matches add column if not exists result_type text;              -- 'Normal', 'Tie', 'Super Over', 'No Result'
alter table matches add column if not exists man_of_match_player_id uuid references players(id) on delete set null;
alter table matches add column if not exists cricheroes_url text;

-- 2. Super overs + per-innings overs -----------------------------------------
alter table innings drop constraint if exists innings_innings_number_check;
alter table innings add column if not exists is_super_over boolean not null default false;
alter table innings add column if not exists overs_limit int;

-- 3. Commentary + wagon wheel on each ball -----------------------------------
alter table balls add column if not exists commentary text;
alter table balls add column if not exists shot_x numeric;   -- 0..1, optional
alter table balls add column if not exists shot_y numeric;

-- 4. Playing XI ----------------------------------------------------------------
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

-- 5. Scorecards ----------------------------------------------------------------
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

-- 6. Rebuild an innings' scorecards from its balls ---------------------------
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

  -- Batting card
  delete from batting_cards where innings_id = p_innings_id;

  with appearances as (
    select b.striker_id as pid, b.sequence_no * 2 as k
    from balls b where b.innings_id = p_innings_id and b.striker_id is not null
    union all
    select b.non_striker_id, b.sequence_no * 2 + 1
    from balls b where b.innings_id = p_innings_id and b.non_striker_id is not null
    union all
    select b.new_batsman_id, b.sequence_no * 2 + 1
    from balls b where b.innings_id = p_innings_id and b.new_batsman_id is not null
  ),
  firsts as (
    select pid, min(k) as first_k from appearances group by pid
  ),
  bat as (
    select b.striker_id as pid,
           sum(b.runs_off_bat) as n_runs,
           count(*) filter (where b.extra_type is null or b.extra_type in ('no_ball','bye','leg_bye')) as n_balls,
           count(*) filter (where b.runs_off_bat = 4) as n_fours,
           count(*) filter (where b.runs_off_bat = 6) as n_sixes
    from balls b
    where b.innings_id = p_innings_id and b.striker_id is not null
      and b.extra_type is distinct from 'penalty'
    group by b.striker_id
  ),
  outs as (
    select distinct on (b.dismissed_player_id)
           b.dismissed_player_id as pid, b.wicket_type, b.bowler_id, b.fielder_id,
           (b.is_wicket and b.wicket_type is distinct from 'Retired Hurt') as out_flag
    from balls b
    where b.innings_id = p_innings_id and b.dismissed_player_id is not null
    order by b.dismissed_player_id, b.sequence_no desc
  )
  insert into batting_cards (innings_id, match_id, team_id, player_id, batting_position,
                             runs, balls, fours, sixes, is_out, dismissal_type, bowler_id, fielder_id)
  select p_innings_id, v_match_id, v_bat_team, f.pid,
         row_number() over (order by f.first_k),
         coalesce(bt.n_runs, 0), coalesce(bt.n_balls, 0), coalesce(bt.n_fours, 0), coalesce(bt.n_sixes, 0),
         coalesce(o.out_flag, false),
         o.wicket_type,
         case when o.wicket_type in ('Bowled','Caught','Caught & Bowled','LBW','Stumped','Hit Wicket')
              then o.bowler_id end,
         o.fielder_id
  from firsts f
  left join bat bt on bt.pid = f.pid
  left join outs o on o.pid = f.pid;

  -- Bowling card
  delete from bowling_cards where innings_id = p_innings_id;

  with deliveries as (
    select b.bowler_id, b.sequence_no, b.over_number, b.is_wicket, b.wicket_type,
           b.extra_type, b.runs_off_bat,
           (b.extra_type is null or b.extra_type in ('bye','leg_bye')) as is_legal,
           b.runs_off_bat + case when b.extra_type in ('wide','no_ball') then b.extra_runs else 0 end as bowler_runs
    from balls b
    where b.innings_id = p_innings_id and b.bowler_id is not null
      and b.extra_type is distinct from 'penalty'
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
           min(sequence_no) as first_seq,
           count(*) filter (where is_legal) as n_legal,
           sum(bowler_runs) as n_runs,
           count(*) filter (where is_wicket and wicket_type in
                            ('Bowled','Caught','Caught & Bowled','LBW','Stumped','Hit Wicket')) as n_wkts,
           count(*) filter (where extra_type = 'wide') as n_wd,
           count(*) filter (where extra_type = 'no_ball') as n_nb,
           count(*) filter (where is_legal and bowler_runs = 0) as n_dots,
           count(*) filter (where runs_off_bat = 4) as n_4,
           count(*) filter (where runs_off_bat = 6) as n_6
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

-- Build scorecards for any innings already scored (e.g. test matches)
do $$
begin
  perform recompute_innings(i.id) from innings i;
end $$;

-- 7. Security for the new tables: anyone can view, admins/scorers edit -------
alter table match_players enable row level security;
alter table batting_cards enable row level security;
alter table bowling_cards enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['match_players','batting_cards','bowling_cards'] loop
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
