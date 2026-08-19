-- ============================================================================
-- MTCC UAE — Allow Super Admin / Tournament Admin to delete a player
--
-- There was previously no DELETE policy on `players` at all, so RLS was
-- silently blocking every delete attempt regardless of role. This adds the
-- policy; the app's deletePlayer() server action separately refuses to
-- delete any player already sold to a team, to protect auction results.
-- ============================================================================

create policy "players: decision roles can delete"
  on players for delete
  using (has_role('Super Admin', 'Tournament Admin'));
