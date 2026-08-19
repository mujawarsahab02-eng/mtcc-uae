-- ============================================================================
-- MTCC UAE — Admin-verified CricHeroes stats + computed age for the auction
--
-- These stats are entered by an admin during player review (reading them off
-- the player's CricHeroes profile), never self-reported by the player —
-- this was a deliberate choice to avoid players entering false numbers.
-- dob is added to player_public ONLY so the UI can compute an age number;
-- no page should ever render the raw date, just the derived age.
-- ============================================================================

alter table players
  add column if not exists cricheroes_matches int,
  add column if not exists cricheroes_runs int,
  add column if not exists cricheroes_wickets int;

create or replace view player_public as
  select
    id, player_code, full_name, photo_path, playing_role, batting_style,
    bowling_style, district, state, player_type, category,
    auction_category, application_status, team_id, sold_points,
    dob, cricheroes_matches, cricheroes_runs, cricheroes_wickets
  from players;

grant select on player_public to anon, authenticated;
