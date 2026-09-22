-- MTCC UAE — Auction display: "Going once / twice" call and bid timer.
alter table auction_state add column if not exists call_status text;
alter table auction_state add column if not exists timer_seconds int;
alter table auction_state add column if not exists timer_ends_at timestamptz;
notify pgrst, 'reload schema';
