-- ============================================================================
-- MTCC UAE — Enable Realtime broadcasting
--
-- Having RLS policies that allow SELECT is not the same as Supabase actually
-- broadcasting row changes over Realtime — that requires the table to be
-- added to the `supabase_realtime` publication. This was missing from the
-- earlier migrations, which is why the Control Room, Display page, and Team
-- Owner dashboard weren't updating live.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'auction_state'
  ) then
    alter publication supabase_realtime add table auction_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table players;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table teams;
  end if;
end $$;
