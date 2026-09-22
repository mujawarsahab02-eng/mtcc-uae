-- MTCC UAE — Auction rounds: marks whether the live pool is the Main list
-- or the Unsold Round, so every screen can label it.
alter table auction_state add column if not exists round text not null default 'Main';
notify pgrst, 'reload schema';
