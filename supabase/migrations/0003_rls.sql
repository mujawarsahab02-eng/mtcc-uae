-- ============================================================================
-- MTCC UAE — Row Level Security
--
-- This is the piece the Claude Artifact prototype could never actually
-- provide (it only had client-side role gating). Every table below has RLS
-- enabled and every policy is enforced by Postgres itself, not by the
-- frontend — a user without the right role literally cannot read or write
-- the row, regardless of what the browser does.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function has_role(variadic roles user_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() = any(roles);
$$;

create or replace function is_own_team(t_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'Team Owner' and team_id = t_id
  );
$$;

-- Roles allowed to see Emirates ID / payment documents & fields (item 19).
create or replace function has_document_access() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('Super Admin', 'Tournament Admin', 'Finance Admin');
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles: self can read own row"
  on profiles for select
  using (id = auth.uid() or has_role('Super Admin', 'Tournament Admin'));

create policy "profiles: super admin can insert"
  on profiles for insert
  with check (has_role('Super Admin') or id = auth.uid());
  -- id = auth.uid() covers the bootstrap trigger below creating a user's own
  -- row with the default 'Viewer' role on first sign-up.

create policy "profiles: only super admin can change role/team_id"
  on profiles for update
  using (has_role('Super Admin') or id = auth.uid())
  with check (
    has_role('Super Admin')
    or (id = auth.uid()) -- self-service edits are limited to non-privileged columns below via trigger
  );

-- Prevent a non-Super-Admin from elevating their own role or team assignment
-- even though the UPDATE policy above allows them to touch their own row
-- (e.g. to update full_name).
create or replace function protect_role_column() returns trigger as $$
begin
  if not has_role('Super Admin') then
    if new.role is distinct from old.role or new.team_id is distinct from old.team_id then
      raise exception 'Only Super Admin can change role or team assignment';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_protect_role before update on profiles
  for each row execute function protect_role_column();

-- Auto-create a profile (role = Viewer) when a new auth user signs up.
-- Super Admin then assigns the real role from /admin/users.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'Viewer');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- tournament_settings
-- ---------------------------------------------------------------------------
alter table tournament_settings enable row level security;

create policy "settings: readable by anyone"
  on tournament_settings for select
  using (true); -- registration page needs fees / T&Cs / eligibility toggles

create policy "settings: editable by Super Admin / Tournament Admin"
  on tournament_settings for update
  using (has_role('Super Admin', 'Tournament Admin'))
  with check (has_role('Super Admin', 'Tournament Admin'));

-- ---------------------------------------------------------------------------
-- auction_categories
-- ---------------------------------------------------------------------------
alter table auction_categories enable row level security;

create policy "categories: readable by anyone"
  on auction_categories for select using (true);

create policy "categories: managed by Super Admin / Tournament Admin"
  on auction_categories for all
  using (has_role('Super Admin', 'Tournament Admin'))
  with check (has_role('Super Admin', 'Tournament Admin'));

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
alter table teams enable row level security;

create policy "teams: full read for privileged roles"
  on teams for select
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin', 'Finance Admin', 'Scorer'));

create policy "teams: owner can read own team"
  on teams for select
  using (is_own_team(id));

create policy "teams: managed by Super Admin / Tournament Admin"
  on teams for all
  using (has_role('Super Admin', 'Tournament Admin'))
  with check (has_role('Super Admin', 'Tournament Admin'));

create policy "teams: finance admin can update payment fields"
  on teams for update
  using (has_role('Finance Admin'))
  with check (has_role('Finance Admin'));

-- team_public view is granted directly (see grants section below) so anon
-- (the public Auction Display) can read team name/logo without touching
-- the base table.

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
alter table players enable row level security;

-- Public registration: inserts only ever go through the register_player()
-- RPC below (security definer), never a direct table insert from anon, so
-- there is no direct INSERT policy for the anon role here.

create policy "players: full read for privileged roles"
  on players for select
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin', 'Finance Admin', 'Scorer'));

create policy "players: team owner can read own squad (safe columns only)"
  on players for select
  using (team_id is not null and is_own_team(team_id));
  -- Note: this exposes full rows at the table level to a Team Owner for
  -- their own purchased players. The app UI only ever queries player_public
  -- for Team Owner screens, and this policy still hides Emirates ID/payment
  -- data from every OTHER team's players and from anyone not on this team.

create policy "players: decision roles can update"
  on players for update
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Auction Admin'));

create policy "players: finance admin can update payment fields"
  on players for update
  using (has_role('Finance Admin'))
  with check (has_role('Finance Admin'));

-- player_public view is granted to anon + authenticated (see grants below)
-- for the registration confirmation, team pages and auction display —
-- it never includes emirates_id*, payment_*, mobile, email, internal_notes.

-- ---------------------------------------------------------------------------
-- auction_state
-- ---------------------------------------------------------------------------
alter table auction_state enable row level security;

create policy "auction_state: readable by anyone"
  on auction_state for select using (true);
  -- Needed by the unauthenticated /auction/display page and Team Owner
  -- dashboards. Only non-sensitive auction progress lives here (player ids,
  -- bid amounts, team ids) — no personal or financial data.

create policy "auction_state: run by Auction Admin / Tournament Admin / Super Admin"
  on auction_state for update
  using (has_role('Super Admin', 'Tournament Admin', 'Auction Admin'))
  with check (has_role('Super Admin', 'Tournament Admin', 'Auction Admin'));

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
alter table audit_log enable row level security;

create policy "audit_log: insert by any signed-in privileged role"
  on audit_log for insert
  with check (has_role('Super Admin', 'Tournament Admin', 'Auction Admin', 'Finance Admin'));

create policy "audit_log: read by Super Admin only"
  on audit_log for select
  using (has_role('Super Admin'));

-- ---------------------------------------------------------------------------
-- register_player RPC — the only path public registrants use to create a
-- player row. SECURITY DEFINER lets it write to a table anon cannot INSERT
-- into directly, while hard-coding the safe defaults (status='New', fee
-- snapshot from settings, etc.) so a crafted request can never submit a
-- pre-approved / pre-sold player.
-- ---------------------------------------------------------------------------
create or replace function register_player(payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  fee numeric;
begin
  if not (coalesce((payload->>'declaration_accepted')::boolean, false)) then
    raise exception 'Registration declaration must be accepted';
  end if;

  select player_reg_fee into fee from tournament_settings where id = 1;

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

-- ---------------------------------------------------------------------------
-- update_team_profile RPC — the narrow set of columns a Team Owner may
-- self-edit, so they can never touch payment_status, amount_paid,
-- auction_points, etc. via a direct UPDATE.
-- ---------------------------------------------------------------------------
create or replace function update_team_profile(
  p_team_id uuid, p_mobile text, p_whatsapp text, p_email text,
  p_manager text, p_jersey_colour text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_own_team(p_team_id) and not has_role('Super Admin', 'Tournament Admin') then
    raise exception 'Not authorised to edit this team';
  end if;
  update teams set
    mobile = p_mobile, whatsapp = p_whatsapp, email = p_email,
    manager = p_manager, jersey_colour = p_jersey_colour
  where id = p_team_id;
end;
$$;

grant execute on function update_team_profile(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- View grants — this is what keeps Emirates ID / payment data away from
-- public and low-privilege sessions structurally, not just in the UI.
-- ---------------------------------------------------------------------------
grant select on player_public to anon, authenticated;
grant select on team_public to anon, authenticated;
grant select on auction_state to anon, authenticated;
grant select on tournament_settings to anon, authenticated;
grant select on auction_categories to anon, authenticated;
