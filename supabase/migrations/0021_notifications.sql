alter table tournament_settings
  add column if not exists admin_notification_email text default '';
