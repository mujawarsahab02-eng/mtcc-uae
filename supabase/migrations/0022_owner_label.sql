-- A purely cosmetic label — does NOT affect team_role, auction eligibility,
-- squad counting, or purse math. Lets a normal Auction Player (or anyone)
-- also be marked "Also the Team Owner" for display purposes only.
alter table players
  add column if not exists is_team_owner_label boolean not null default false;
