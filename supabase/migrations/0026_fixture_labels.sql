-- ============================================================================
-- MTCC UAE — Typed-in team names for fixtures
--
-- Lets a fixture show a placeholder like "Winner of QF1" before the real
-- teams are known. Once real teams are picked, the ids are used instead.
-- Custom stage names need no change (stage is already free text).
-- ============================================================================

alter table matches add column if not exists team_a_label text;
alter table matches add column if not exists team_b_label text;

-- Small public view so the public fixtures list can show the placeholders
-- without changing the existing match_public view.
create or replace view match_labels_public as
  select id, team_a_label, team_b_label from matches;

grant select on match_labels_public to anon, authenticated;

notify pgrst, 'reload schema';
