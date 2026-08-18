-- ============================================================================
-- MTCC UAE — About/Mission content + expanded, categorized rules fields
--
-- Mirrors the richer public storytelling and detailed rules sections seen
-- on comparable community tournament sites. All editable from
-- /admin/settings — no rule text is assumed/hardcoded here since MTCC's
-- actual tennis-cricket playing conditions are the organiser's to define.
-- ============================================================================

alter table tournament_settings
  add column if not exists about_text text default '',
  add column if not exists vision_text text default '',
  add column if not exists mission_points text default '',
  add column if not exists general_rules text default '',
  add column if not exists match_conditions_rules text default '',
  add column if not exists substitution_rules text default '',
  add column if not exists super_over_rules text default '';
