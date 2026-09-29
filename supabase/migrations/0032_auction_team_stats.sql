-- ============================================================================
-- MTCC UAE — Instant team purses on the auction display
--
-- The Display screen was working out each team's purse by re-reading every
-- sold player, which is both slow and a step behind the sale. Instead the
-- server now works the team table out at the moment of the sale and saves
-- it here, so the display reads the purse from the same row it already
-- reads the bid from — always in step, and with no extra queries.
-- Safe to run more than once.
-- ============================================================================

alter table auction_state add column if not exists team_stats jsonb;
alter table auction_state add column if not exists round_stats jsonb;
alter table auction_state add column if not exists round text not null default 'Main';

alter table auction_state replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table auction_state;
  exception when others then null;
  end;
end $$;

notify pgrst, 'reload schema';

-- Must list auction_state. If it does not, the live feed is off and the
-- display would be relying on its half-second backup poll.
select tablename as realtime_enabled
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'auction_state';
