-- ============================================================================
-- MTCC UAE — Fixed bid increment system
--
-- Replaces the old flexible "+5/+10/+25/+50 or type any custom amount"
-- bidding controls with a single fixed step, per the organiser's actual
-- auction rules: start at 1000, +500 per bid, cap at 25000. All three
-- numbers are editable in Settings rather than hardcoded, in case the
-- amounts change for a future season.
-- ============================================================================

alter table tournament_settings
  add column if not exists auction_starting_bid int not null default 1000,
  add column if not exists auction_bid_increment int not null default 500,
  add column if not exists auction_max_bid int not null default 25000;
