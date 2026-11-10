-- ============================================================================
-- MTCC UAE — Free-flow scoring (guest teams and guest players)
--
-- Lets a scorer score any match, CricHeroes-style: type the team names and add
-- players by name. Guest teams/players live in their own tables, so they never
-- appear in the real Teams, Players, Auction, Finance or registration counts.
--
-- Safe to run: it only adds tables and a function, and removes the foreign keys
-- that force scoring columns to point at the real teams/players tables
-- (the columns keep working with either kind of id).
-- ============================================================================

-- 1. Guest tables ----------------------------------------------------------------
create table if not exists guest_teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists guest_teams_match_idx on guest_teams (match_id);

create table if not exists guest_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references guest_teams(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists guest_players_match_idx on guest_players (match_id);

alter table guest_teams enable row level security;
alter table guest_players enable row level security;

-- Names are public (they show on the public match page); only scorers/admins write.
drop policy if exists "guest_teams: read" on guest_teams;
create policy "guest_teams: read" on guest_teams for select using (true);
drop policy if exists "guest_teams: write" on guest_teams;
create policy "guest_teams: write" on guest_teams for all
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));

drop policy if exists "guest_players: read" on guest_players;
create policy "guest_players: read" on guest_players for select using (true);
drop policy if exists "guest_players: write" on guest_players;
create policy "guest_players: write" on guest_players for all
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));

grant select on guest_teams, guest_players to anon, authenticated;
grant insert, update, delete on guest_teams, guest_players to authenticated;

-- 2. Let scoring columns hold guest ids -------------------------------------------
-- Drops only foreign keys that point at teams or players, on the matches and
-- scoring tables. Everything else (match -> innings -> balls cascades) stays.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid in ('public.teams'::regclass, 'public.players'::regclass)
      and c.conrelid in (
        select ('public.' || t)::regclass
        from unnest(array['matches','innings','balls','match_players','batting_cards','bowling_cards']) t
        where to_regclass('public.' || t) is not null
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 3. Scoring squad list: registered players plus the match's guest players ------
create or replace function scoring_players(p_match uuid)
returns table (id uuid, full_name text, team_id uuid, team_role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.team_id, p.team_role::text
  from players p
  join matches m on m.id = p_match
  where p.team_id in (m.team_a_id, m.team_b_id)
    and has_role('Super Admin', 'Tournament Admin', 'Scorer')
  union all
  select g.id, g.full_name, g.team_id, 'Auction Player'::text
  from guest_players g
  where g.match_id = p_match
    and has_role('Super Admin', 'Tournament Admin', 'Scorer');
$$;
revoke all on function scoring_players(uuid) from public, anon;
grant execute on function scoring_players(uuid) to authenticated;
