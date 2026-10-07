-- MTCC UAE Season 1 — seed the 13-match schedule (15 Nov 2026).
-- Run once. Does nothing if matches already exist. After this, edit everything
-- (teams, dates, times, ground) in Admin -> Fixtures.
do $$
declare
  wk uuid; mi uuid; zn uuid; sh uuid; an uuid; rs uuid; df uuid; md uuid;
  g text := 'Farhan Sports Ground Bataya';
  d date := '2026-11-15';
begin
  if exists (select 1 from matches) then
    raise notice 'matches table is not empty - nothing inserted';
    return;
  end if;
  select id into wk from teams where name ilike 'WK%' limit 1;
  select id into mi from teams where name ilike 'MI %' limit 1;
  select id into zn from teams where name ilike 'Zainab%' limit 1;
  select id into sh from teams where name ilike 'Shams%' limit 1;
  select id into an from teams where name ilike 'Anas%' limit 1;
  select id into rs from teams where name ilike 'Rising%' limit 1;
  select id into df from teams where name ilike 'Desert%' limit 1;
  select id into md from teams where name ilike 'Maldoli%' limit 1;

  insert into matches (match_number, team_a_id, team_b_id, team_a_label, team_b_label, match_date, match_time, ground, group_name, stage) values
   (1,  wk, mi, null, null, d, '07:30', g, 'Group A', 'League'),
   (2,  zn, sh, null, null, d, '08:30', g, 'Group B', 'League'),
   (3,  an, rs, null, null, d, '09:30', g, 'Group A', 'League'),
   (4,  df, md, null, null, d, '10:30', g, 'Group B', 'League'),
   (5,  null, null, 'Winner Match 1', 'Winner Match 3', d, '11:30', g, 'Group A', 'League'),
   (6,  null, null, 'Winner Match 2', 'Winner Match 4', d, '12:30', g, 'Group B', 'League'),
   (7,  null, null, 'Loser Match 1',  'Loser Match 3',  d, '13:30', g, 'Group A', 'League'),
   (8,  null, null, 'Loser Match 2',  'Loser Match 4',  d, '14:30', g, 'Group B', 'League'),
   (9,  null, null, 'Winner Match 7', 'Loser Match 5',  d, '15:30', g, 'Group A', 'League'),
   (10, null, null, 'Winner Match 8', 'Loser Match 6',  d, '16:30', g, 'Group B', 'League'),
   (11, null, null, 'Winner of Match 5', 'Winner of Match 9',  d, '17:30', g, 'Group A', 'Semi-Final'),
   (12, null, null, 'Winner of Match 6', 'Winner of Match 10', d, '18:30', g, 'Group B', 'Semi-Final'),
   (13, null, null, 'Winner of Semi Final 1', 'Winner of Semi Final 2', d, '19:30', g, null, 'Final');
end $$;
notify pgrst, 'reload schema';
