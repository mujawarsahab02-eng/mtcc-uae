-- ============================================================================
-- MTCC UAE — Core schema
-- Mirrors the data model from the Claude Artifact prototype 1:1 so the
-- existing tournament logic (statuses, categories, auction rules) ports
-- over without redesign.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum (
  'Super Admin',
  'Tournament Admin',
  'Auction Admin',
  'Finance Admin',
  'Team Owner',
  'Scorer',
  'Viewer'
);

create type player_type as enum ('Maharashtra Player', 'Guest Indian Player');

create type player_category as enum (
  'Maharashtra Player',
  'Guest Player',
  'Overseas / Special Category',
  'To Be Reviewed'
);

create type application_status as enum (
  'New',
  'Under Review',
  'Approved for Auction',
  'Auction Pool',
  'Rejected',
  'Sold / Selected',
  'Unsold / Not Selected',
  'Withdrawn'
);

create type payment_status as enum ('Pending', 'Paid', 'Verified', 'Rejected');
create type team_payment_status as enum ('Pending', 'Partial', 'Paid', 'Verified');
create type auction_run_status as enum ('idle', 'live', 'paused', 'completed');

-- ---------------------------------------------------------------------------
-- profiles — one row per Supabase Auth user. Role is assigned by Super Admin
-- only (never self-selected — see RLS policies in 0002).
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role user_role not null default 'Viewer',
  team_id uuid, -- set for Team Owner accounts; FK added after teams table exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tournament_settings — singleton row (id always 1). Same fields as the
-- artifact's DEFAULT_SETTINGS object.
-- ---------------------------------------------------------------------------
create table tournament_settings (
  id int primary key default 1 check (id = 1),
  tournament_name text not null default 'Maharashtra Tennis Cricket Championship UAE',
  season text not null default 'Season 1',
  format text not null default 'One-Day, Tennis Cricket, Grass Ground',
  country text not null default 'UAE',
  auction_based boolean not null default true,
  number_of_teams int not null default 8,
  max_squad_size int not null default 14,
  playing_xi int not null default 11,
  number_of_overs int not null default 16,
  number_of_groups int not null default 2,
  format_type text not null default 'League + Knockout',
  team_entry_fee numeric not null default 1500,
  player_reg_fee numeric not null default 25,
  currency text not null default 'AED',
  cricheroes_required boolean not null default true,
  emirates_id_required boolean not null default true,
  eligibility_mode text not null default 'maharashtra_guest', -- 'maharashtra_only' | 'maharashtra_guest'
  guest_quota int not null default 3,
  auction_points_per_team numeric not null default 1000,
  tournament_date date,
  venue text,
  ground_name text,
  reporting_time time,
  start_time time,
  end_time time,
  number_of_grounds int not null default 1,
  qualification_rules text,
  points_rules text,
  nrr_rules text,
  tie_break_rules text,
  player_eligibility_rules text,
  registration_open_date date,
  registration_close_date date,
  auction_date_time timestamptz,
  allow_overseas_category boolean not null default false,
  terms_and_conditions text not null default
    'Registration does not guarantee selection in the auction. The AED 25 player registration fee is strictly non-refundable, including in the event a player is not selected. No salary, auction payment or monetary consideration will be paid to a player for being selected in the auction. This does not affect tournament performance awards or prizes. All participants must hold a valid Emirates ID and an active CricHeroes profile at the time of registration.',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- auction_categories — configurable (Marquee/Premium/... or A+/A/B...)
-- ---------------------------------------------------------------------------
create table auction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  team_code text not null unique default ('MTCC-T-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  name text not null,
  logo_path text, -- storage path in team-logos bucket
  owner_name text,
  owner_user_id uuid references auth.users (id) on delete set null,
  company text,
  mobile text,
  whatsapp text,
  email text,
  manager text,
  jersey_colour text,
  entry_fee_amount numeric not null default 1500,
  amount_paid numeric not null default 0,
  payment_status team_payment_status not null default 'Pending',
  payment_reference text,
  payment_date date,
  payment_receipt_path text, -- storage path in payment-receipts bucket (private)
  auction_points numeric not null default 1000,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_team_id_fkey foreign key (team_id) references teams (id) on delete set null;

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  player_code text not null unique default ('MTCC-P-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),

  full_name text not null,
  photo_path text, -- storage path in player-photos bucket (public bucket)
  dob date,
  mobile text not null,
  whatsapp text,
  email text,
  emirate text,
  uae_location text,

  player_type player_type,
  district text,          -- Maharashtra District / Home Town
  state text,              -- State in India (Guest Indian Player)
  nationality text not null default 'Indian',

  emirates_id text,
  emirates_id_expiry date,
  emirates_id_path text,   -- storage path in emirates-ids bucket (private)

  cricheroes_url text,
  playing_role text not null,       -- Batsman / Bowler / All-Rounder / Wicketkeeper-Batsman
  batting_style text,
  bowling_style text,
  batting_position text,
  current_team text,
  previous_teams text,
  experience text,
  major_experience text,
  achievements text,
  uae_experience text,

  category player_category not null default 'To Be Reviewed',
  application_status application_status not null default 'New',
  auction_category text references auction_categories (name) on update cascade on delete set null,

  team_id uuid references teams (id) on delete set null, -- set when Sold
  sold_points numeric,

  registration_fee_amount numeric not null default 25,
  amount_paid numeric not null default 0,
  payment_status payment_status not null default 'Pending',
  payment_reference text,
  payment_date date,
  payment_receipt_path text, -- storage path in payment-receipts bucket (private)

  declaration_accepted boolean not null default false,
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_application_status_idx on players (application_status);
create index players_auction_category_idx on players (auction_category);
create index players_team_id_idx on players (team_id);

-- ---------------------------------------------------------------------------
-- auction_state — singleton control row (id always 1). Realtime-subscribed
-- by the Control Room, Team Owner dashboards and the public Display page.
-- pool_order is an ordered array of player ids; DEFER moves an id to the end.
-- ---------------------------------------------------------------------------
create table auction_state (
  id int primary key default 1 check (id = 1),
  status auction_run_status not null default 'idle',
  pool_order uuid[] not null default '{}',
  pool_index int not null default 0,
  current_player_id uuid references players (id),
  current_bid numeric not null default 0,
  current_team_id uuid references teams (id),
  bid_history jsonb not null default '[]'::jsonb,
  action_log jsonb not null default '[]'::jsonb, -- for "Undo Last Player Result"
  last_action jsonb, -- { type: 'SOLD'|'UNSOLD', playerName, teamName, amount, ts }
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log — operational trail (see docs/AUDIT.md for what this does and
-- does not guarantee).
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  role user_role,
  action text not null,
  entity text not null,       -- 'Player' | 'Team' | 'Settings' | 'Auction'
  entity_id text,
  field text,
  previous_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Safe public views — expose only non-sensitive columns for the public
-- Registration confirmation, Team pages and Auction Display. Emirates ID,
-- payment references/dates/receipts and internal notes are never selected
-- here (item 19 of the security requirements).
-- ---------------------------------------------------------------------------
create view player_public as
  select
    id, player_code, full_name, photo_path, playing_role, batting_style,
    bowling_style, district, state, player_type, category,
    auction_category, application_status, team_id, sold_points
  from players;

create view team_public as
  select id, team_code, name, logo_path, auction_points
  from teams;

-- updated_at triggers
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger players_set_updated_at before update on players
  for each row execute function set_updated_at();
create trigger teams_set_updated_at before update on teams
  for each row execute function set_updated_at();
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger settings_set_updated_at before update on tournament_settings
  for each row execute function set_updated_at();
