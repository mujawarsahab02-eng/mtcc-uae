-- Scorer sign-up stores the scorer's mobile number on their profile.
alter table profiles add column if not exists mobile text;
notify pgrst, 'reload schema';
