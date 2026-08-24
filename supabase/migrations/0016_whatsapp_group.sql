alter table tournament_settings
  add column if not exists whatsapp_group_link text default '';
