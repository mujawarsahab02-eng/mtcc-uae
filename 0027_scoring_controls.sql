-- ============================================================================
-- MTCC UAE — Scoring controls
--
-- 1. balls.event_type: non-delivery events in the ball log (a batter retiring
--    between deliveries). They never count as a ball faced or bowled.
-- 2. innings.declared: the scorer ended the innings early.
-- 3. Scorecard rebuild function updated to skip event rows.
-- ============================================================================

alter table balls add column if not exists event_type text;
alter table innings add column if not exists declared boolean not null default false;

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
      and b.event_type is null
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
      and b.event_type is null
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

notify pgrst, 'reload schema';
