-- Admin-managed category list for the Finance Tracker, replacing the
-- previously hardcoded options. Starts empty — Super Admin builds their
-- own list from the Finance Tracker page.
create table if not exists transaction_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Income', 'Expense')),
  name text not null,
  created_at timestamptz not null default now()
);

alter table transaction_categories enable row level security;

create policy "Super Admin full access to transaction categories"
on transaction_categories
for all
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'Super Admin')
)
with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'Super Admin')
);
