-- ============================================================================
-- MTCC UAE — Auction speed & reliability
--
-- 1. Makes sure the "round" column exists (Main vs Unsold Round).
-- 2. Puts auction_state, players and teams on Supabase Realtime, so the
--    Control Room and Display Mode hear about a bid the instant it lands
--    instead of waiting for the next poll. This was the main cause of the
--    lag between the admin screen and the display.
-- 3. Sets REPLICA IDENTITY FULL so those live messages carry every column,
--    not just the changed ones.
-- Safe to run more than once.
-- ============================================================================

alter table auction_state add column if not exists round text not null default 'Main';

alter table auction_state replica identity full;
alter table players       replica identity full;
alter table teams         replica identity full;

do $$
declare t text;
begin
  foreach t in array array['auction_state', 'players', 'teams'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
             when others then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Confirms what is now live. Expect all three tables listed.
select tablename as realtime_enabled_tables
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('auction_state', 'players', 'teams')
order by tablename;
