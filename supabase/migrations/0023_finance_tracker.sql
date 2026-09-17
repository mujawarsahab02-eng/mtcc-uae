-- ============================================================================
-- MTCC UAE — Income & Expense Tracker
--
-- Standalone ledger table. Player registration fees and team entry fees
-- auto-create an Income entry here when marked paid (source/source_id trace
-- back to the original record so we never double-count on repeated saves).
-- Everything else is entered manually by Super Admin.
-- ============================================================================

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Income', 'Expense')),
  category text not null,
  description text,
  amount numeric not null default 0,
  txn_date date not null default current_date,
  payment_method text,
  receipt_path text,
  notes text,
  recorded_by text,
  source text,
  source_id uuid,
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

create policy "Super Admin full access to transactions"
on transactions
for all
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'Super Admin')
)
with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'Super Admin')
);

alter table teams
  add column if not exists entry_fee_status text not null default 'Pending';

alter table teams
  add column if not exists entry_fee_paid_date date;
