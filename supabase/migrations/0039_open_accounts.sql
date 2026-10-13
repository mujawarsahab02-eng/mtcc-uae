-- ============================================================================
-- MTCC UAE — Open sign-up for scorers, without exposing private player data
--
-- Anyone can now create an account (email or mobile + password) and is stored
-- as a Scorer. A Scorer must NOT be able to read private player/team columns
-- (Emirates ID, contact, payment) or delete fixtures, so:
--   1. Scorer is removed from the "full read" policies on players and teams.
--   2. The scoring screen gets squads through scoring_players() (safe columns).
--   3. Scorers can add/update fixtures but not delete them.
-- ============================================================================

-- 1. Scorer loses full read of players and teams.
drop policy if exists "players: full read for privileged roles" on players;
create policy "players: full read for privileged roles"
  on players for select
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin', 'Finance Admin'));

drop policy if exists "teams: full read for privileged roles" on teams;
create policy "teams: full read for privileged roles"
  on teams for select
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin', 'Finance Admin'));

-- 2. Safe squad list for the scoring screen.
create or replace function scoring_players(p_match uuid)
returns table (id uuid, full_name text, team_id uuid, team_role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.team_id, p.team_role::text
  from players p
  join matches m on m.id = p_match
  where p.team_id in (m.team_a_id, m.team_b_id)
    and has_role('Super Admin', 'Tournament Admin', 'Scorer');
$$;
revoke all on function scoring_players(uuid) from public, anon;
grant execute on function scoring_players(uuid) to authenticated;

-- 3. Scorers can add and update fixtures but not delete them.
drop policy if exists "matches: managed by Super Admin / Tournament Admin / Scorer" on matches;
create policy "matches: insert by Super Admin / Tournament Admin / Scorer" on matches for insert
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));
create policy "matches: update by Super Admin / Tournament Admin / Scorer" on matches for update
  using (has_role('Super Admin', 'Tournament Admin', 'Scorer'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Scorer'));
create policy "matches: delete by Super Admin / Tournament Admin" on matches for delete
  using (has_role('Super Admin', 'Tournament Admin'));

notify pgrst, 'reload schema';
