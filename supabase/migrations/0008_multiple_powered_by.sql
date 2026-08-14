-- ============================================================================
-- MTCC UAE — Multiple "Powered By" entries
--
-- Reuses the sponsors table with a flag rather than a separate table, so the
-- existing Sponsors admin page manages both. Also migrates the single
-- powered_by_name/powered_by_logo_path values already set in
-- tournament_settings into a real sponsors row, so nothing is lost.
-- ============================================================================

alter table sponsors
  add column if not exists is_powered_by boolean not null default false;

insert into sponsors (name, logo_path, is_powered_by, sort_order)
select powered_by_name, nullif(powered_by_logo_path, ''), true,
       coalesce((select max(sort_order) + 1 from sponsors), 0)
from tournament_settings
where id = 1
  and coalesce(powered_by_name, '') <> ''
  and not exists (select 1 from sponsors where is_powered_by = true and name = tournament_settings.powered_by_name);
