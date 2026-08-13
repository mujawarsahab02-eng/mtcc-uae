-- ============================================================================
-- MTCC UAE — Registration cap + bank transfer details + T-shirt note
-- ============================================================================

alter table tournament_settings
  add column if not exists max_registrations int not null default 130,
  add column if not exists bank_account_name text default '',
  add column if not exists bank_name text default '',
  add column if not exists bank_account_number text default '',
  add column if not exists bank_iban text default '',
  add column if not exists shirt_note text not null default 'A team T-shirt will be provided to every registered player.';

-- Re-create register_player() to enforce the registration cap server-side —
-- this is the actual enforcement point (not just the UI), so it can't be
-- bypassed by calling the RPC directly. Also drops emirates_id_path from the
-- required inputs (Emirates ID copy upload was removed) and the five
-- experience/achievement fields are no longer collected from the public
-- form, though the columns remain in case you want them again later.
create or replace function register_player(payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  fee numeric;
  max_reg int;
  current_count int;
begin
  if not (coalesce((payload->>'declaration_accepted')::boolean, false)) then
    raise exception 'Registration declaration must be accepted';
  end if;

  select player_reg_fee, coalesce(max_registrations, 130) into fee, max_reg from tournament_settings where id = 1;
  select count(*) into current_count from players;
  if current_count >= max_reg then
    raise exception 'Registration is closed — the maximum number of players (%) has been reached.', max_reg;
  end if;

  insert into players (
    full_name, photo_path, dob, mobile, whatsapp, email, emirate, uae_location,
    player_type, district, state, nationality,
    emirates_id, emirates_id_expiry, emirates_id_path,
    cricheroes_url, playing_role, batting_style, bowling_style, batting_position,
    current_team, previous_teams, experience, major_experience, achievements, uae_experience,
    category, application_status,
    registration_fee_amount, amount_paid, payment_status, payment_reference, payment_receipt_path,
    declaration_accepted
  ) values (
    payload->>'full_name', payload->>'photo_path', (payload->>'dob')::date,
    payload->>'mobile', payload->>'whatsapp', payload->>'email',
    payload->>'emirate', payload->>'uae_location',
    (payload->>'player_type')::player_type, payload->>'district', payload->>'state',
    coalesce(payload->>'nationality', 'Indian'),
    payload->>'emirates_id', (payload->>'emirates_id_expiry')::date, payload->>'emirates_id_path',
    payload->>'cricheroes_url', payload->>'playing_role', payload->>'batting_style',
    payload->>'bowling_style', payload->>'batting_position',
    payload->>'current_team', payload->>'previous_teams', payload->>'experience',
    payload->>'major_experience', payload->>'achievements', payload->>'uae_experience',
    case when (payload->>'player_type') = 'Guest Indian Player' then 'Guest Player'::player_category
         else 'Maharashtra Player'::player_category end,
    'New',
    coalesce(fee, 25), 0, 'Pending', payload->>'payment_reference', payload->>'payment_receipt_path',
    coalesce((payload->>'declaration_accepted')::boolean, false)
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function register_player(jsonb) to anon, authenticated;
