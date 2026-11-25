-- Auto-fill later fixtures from earlier results.
-- Placeholder fixtures carry labels such as "Winner Match 1", "Loser Match 3",
-- "Winner of Match 5" or "Winner of Semi Final 1". When the source match is
-- completed, the real team is written into team_a_id / team_b_id so scoring,
-- the schedule and the public pages show real teams without typing them in.
-- Only fixtures that have not started (status Scheduled) are touched.

create or replace function public.refresh_fixture_teams()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  lbl text;
  mt text[];
  src_no int;
  src record;
  new_team uuid;
  slot text;
begin
  for m in
    select id, team_a_label, team_b_label, team_a_id, team_b_id
    from matches
    where coalesce(status, 'Scheduled') = 'Scheduled'
      and (team_a_label is not null or team_b_label is not null)
  loop
    foreach slot in array array['a', 'b'] loop
      lbl := case slot when 'a' then m.team_a_label else m.team_b_label end;
      continue when lbl is null;
      mt := regexp_match(trim(lbl), '^(winner|loser)( of)? (match|semi[ -]?final|sf) ?#?(\d+)$', 'i');
      continue when mt is null;
      src_no := mt[4]::int;
      if lower(mt[3]) <> 'match' then
        src_no := 10 + src_no;            -- Semi Final 1 = match 11, Semi Final 2 = match 12
      end if;
      select * into src from matches where match_number = src_no;
      new_team := null;
      if found and src.status = 'Completed' and src.winner_id is not null then
        if lower(mt[1]) = 'winner' then
          new_team := src.winner_id;
        else
          new_team := case when src.winner_id = src.team_a_id then src.team_b_id else src.team_a_id end;
        end if;
      end if;
      if slot = 'a' and m.team_a_id is distinct from new_team then
        update matches set team_a_id = new_team where id = m.id;
      elsif slot = 'b' and m.team_b_id is distinct from new_team then
        update matches set team_b_id = new_team where id = m.id;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.trg_refresh_fixture_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_fixture_teams();
  return null;
end;
$$;

drop trigger if exists matches_advance_fixtures on public.matches;
create trigger matches_advance_fixtures
after insert or update of winner_id, status, team_a_id, team_b_id on public.matches
for each row
when (pg_trigger_depth() = 0)
execute function public.trg_refresh_fixture_teams();

revoke all on function public.refresh_fixture_teams() from public, anon, authenticated;
revoke all on function public.trg_refresh_fixture_teams() from public, anon, authenticated;

-- fill everything that can already be filled (matches 5-8 from results 1-4)
select public.refresh_fixture_teams();
