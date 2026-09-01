-- ============================================================================
-- MTCC UAE — T-shirt size, name, and number
--
-- A small, standalone function rather than modifying register_player
-- directly, so the existing (already-working) registration insert logic
-- is never touched. The registration form calls this immediately after
-- register_player succeeds, using the new player's own id.
-- ============================================================================

alter table players
  add column if not exists tshirt_size text,
  add column if not exists tshirt_name text,
  add column if not exists tshirt_number text;

create or replace function set_player_shirt_details(p_player_id uuid, p_size text, p_name text, p_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update players
  set tshirt_size = p_size, tshirt_name = p_name, tshirt_number = p_number
  where id = p_player_id;
end;
$$;

grant execute on function set_player_shirt_details(uuid, text, text, text) to anon, authenticated;
