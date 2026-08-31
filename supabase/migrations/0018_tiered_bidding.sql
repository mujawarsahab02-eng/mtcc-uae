-- ============================================================================
-- MTCC UAE — Tiered bid increment system
--
-- Replaces the flat "+500 every time" increment with the organiser's actual
-- planned tier structure: the step size gets bigger as the bid climbs.
-- Starting Bid / Bid Increment (existing fields) now represent the base
-- tier (up to the Tier 2 threshold); three more tiers layer on top.
-- ============================================================================

alter table tournament_settings
  add column if not exists auction_tier2_threshold int not null default 10000,
  add column if not exists auction_tier2_increment int not null default 2000,
  add column if not exists auction_tier3_threshold int not null default 15000,
  add column if not exists auction_tier3_increment int not null default 3000,
  add column if not exists auction_tier4_threshold int not null default 20000,
  add column if not exists auction_tier4_increment int not null default 5000;

update tournament_settings
set
  auction_starting_bid = 2000,
  auction_bid_increment = 1000,
  auction_max_bid = 100000
where id = 1;
