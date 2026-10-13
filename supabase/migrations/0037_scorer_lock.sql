-- ============================================================================
-- MTCC UAE — One scorer per match (CricHeroes-style lock + handover)
--
-- * A match has at most one active scorer (scorer_id).
-- * Only that scorer can score. Others see the live score read-only.
-- * The scorer can send scoring to another scorer; that person must accept.
-- * Super Admin can force a take-over (e.g. the scorer's phone died).
-- ============================================================================

alter table matches add column if not exists scorer_id uuid references auth.users(id) on delete set null;
alter table matches add column if not exists scorer_name text;
alter table matches add column if not exists scorer_since timestamptz;
alter table matches add column if not exists handover_to uuid references auth.users(id) on delete set null;
alter table matches add column if not exists handover_to_name text;

create or replace function _scoring_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), 'Scorer') from profiles where id = p_user;
$$;

-- Take the scorer's seat if nobody has it.
create or replace function claim_scoring(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cur uuid;
begin
  if me is null or not has_role('Super Admin','Tournament Admin','Scorer') then
    return jsonb_build_object('error','Only Super Admin, Tournament Admin or Scorer can score.');
  end if;
  select scorer_id into cur from matches where id = p_match for update;
  if not found then return jsonb_build_object('error','Match not found.'); end if;
  if cur is not null and cur <> me then
    return jsonb_build_object('error', (select _scoring_name(cur)) || ' is already scoring this match.');
  end if;
  update matches set scorer_id = me, scorer_name = _scoring_name(me), scorer_since = coalesce(scorer_since, now()),
         handover_to = null, handover_to_name = null where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

-- Scorer gives up the seat (or Super Admin clears it).
create or replace function release_scoring(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cur uuid;
begin
  select scorer_id into cur from matches where id = p_match for update;
  if cur is null then return jsonb_build_object('ok', true); end if;
  if cur <> me and not has_role('Super Admin') then
    return jsonb_build_object('error','Only the current scorer can release scoring.');
  end if;
  update matches set scorer_id = null, scorer_name = null, scorer_since = null,
         handover_to = null, handover_to_name = null where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

-- Current scorer sends scoring to another scorer.
create or replace function send_scoring(p_match uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cur uuid; to_role user_role;
begin
  select scorer_id into cur from matches where id = p_match for update;
  if cur is distinct from me then
    return jsonb_build_object('error','Only the current scorer can send scoring to someone else.');
  end if;
  select role into to_role from profiles where id = p_to;
  if to_role is null or to_role not in ('Super Admin','Tournament Admin','Scorer') then
    return jsonb_build_object('error','That user cannot score matches.');
  end if;
  if p_to = me then return jsonb_build_object('error','You are already the scorer.'); end if;
  update matches set handover_to = p_to, handover_to_name = _scoring_name(p_to) where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

create or replace function cancel_handover(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cur uuid;
begin
  select scorer_id into cur from matches where id = p_match for update;
  if cur is distinct from me and not has_role('Super Admin') then
    return jsonb_build_object('error','Only the current scorer can cancel the hand-over.');
  end if;
  update matches set handover_to = null, handover_to_name = null where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

-- The person it was sent to accepts and becomes the scorer.
create or replace function accept_scoring(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); h uuid;
begin
  select handover_to into h from matches where id = p_match for update;
  if h is distinct from me then
    return jsonb_build_object('error','Scoring was not sent to you.');
  end if;
  update matches set scorer_id = me, scorer_name = _scoring_name(me), scorer_since = now(),
         handover_to = null, handover_to_name = null where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

-- Super Admin emergency take-over.
create or replace function take_over_scoring(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not has_role('Super Admin') then
    return jsonb_build_object('error','Only Super Admin can take over scoring.');
  end if;
  update matches set scorer_id = me, scorer_name = _scoring_name(me), scorer_since = now(),
         handover_to = null, handover_to_name = null where id = p_match;
  return jsonb_build_object('ok', true);
end $$;

-- People who can be chosen as the next scorer.
create or replace function scoring_users() returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.full_name,''), 'Unnamed') as full_name, p.role::text
  from profiles p
  where p.role in ('Super Admin','Tournament Admin','Scorer')
    and p.id <> auth.uid()
    and has_role('Super Admin','Tournament Admin','Scorer')
  order by 2;
$$;

revoke all on function claim_scoring(uuid), release_scoring(uuid), send_scoring(uuid, uuid),
  cancel_handover(uuid), accept_scoring(uuid), take_over_scoring(uuid), scoring_users() from public, anon;
grant execute on function claim_scoring(uuid), release_scoring(uuid), send_scoring(uuid, uuid),
  cancel_handover(uuid), accept_scoring(uuid), take_over_scoring(uuid), scoring_users() to authenticated;

-- Live updates when the scorer changes.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
    alter publication supabase_realtime add table matches;
  end if;
end $$;

notify pgrst, 'reload schema';
