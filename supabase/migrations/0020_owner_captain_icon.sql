-- ============================================================================
-- MTCC UAE — Owner / Captain-Icon players (bypass auction)
--
-- team_role distinguishes players who go through normal auction bidding
-- from an Owner (fixed cost, deducted from purse) or a Captain/Icon (free,
-- purse untouched) who are assigned directly to a team by admin. Both
-- still count toward the squad size, since they occupy a genuine squad
-- slot — this reuses the exact same team_id/sold_points/application_status
-- fields the auction already uses, so existing squad and purse math needs
-- no changes at all.
-- ============================================================================

alter table players
  add column if not exists team_role text not null default 'Auction Player';

alter table players
  drop constraint if exists players_team_role_check;

alter table players
  add constraint players_team_role_check check (team_role in ('Auction Player', 'Owner', 'Captain/Icon'));

alter table tournament_settings
  add column if not exists owner_fixed_points int not null default 5000;
