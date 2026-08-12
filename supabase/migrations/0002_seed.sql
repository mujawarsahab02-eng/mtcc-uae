-- ============================================================================
-- MTCC UAE — Seed data
-- Same defaults as the Claude Artifact prototype's DEFAULT_SETTINGS /
-- DEFAULT_CATEGORIES. All of this remains editable from /admin/settings.
-- ============================================================================

insert into tournament_settings (
  id, tournament_name, season, format, country, auction_based,
  number_of_teams, max_squad_size, playing_xi, number_of_overs, number_of_groups,
  format_type, team_entry_fee, player_reg_fee, currency,
  cricheroes_required, emirates_id_required, eligibility_mode, guest_quota,
  auction_points_per_team,
  qualification_rules, points_rules, nrr_rules, tie_break_rules, player_eligibility_rules
) values (
  1, 'Maharashtra Tennis Cricket Championship UAE', 'Season 1',
  'One-Day, Tennis Cricket, Grass Ground', 'UAE', true,
  8, 14, 11, 16, 2,
  'League + Knockout', 1500, 25, 'AED',
  true, true, 'maharashtra_guest', 3,
  1000,
  'Top 2 teams from each group advance to the knockout stage.',
  'Win = 2 points, Tie/No Result = 1 point, Loss = 0 points.',
  'Net Run Rate used as the first tiebreaker when points are level.',
  'Matches level at the end of overs are decided by a Super Over.',
  'Players must be of Maharashtrian origin, or registered guest players under the guest quota, holding a valid Emirates ID and CricHeroes profile.'
)
on conflict (id) do nothing;

insert into auction_categories (name, sort_order) values
  ('Marquee', 1), ('Premium', 2), ('Regular', 3), ('Emerging', 4)
on conflict (name) do nothing;

insert into auction_state (id) values (1) on conflict (id) do nothing;

-- 8 blank team slots, matching numberOfTeams above. Super Admin / Tournament
-- Admin fill these in from /admin/teams (or change the count in Settings,
-- which resizes this table the same way the artifact's Settings tab did).
insert into teams (name, entry_fee_amount, auction_points)
select 'Team ' || g, 1500, 1000
from generate_series(1, 8) as g
where not exists (select 1 from teams);
