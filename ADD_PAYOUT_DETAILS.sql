-- Run in Supabase SQL editor
alter table tool_sales
  add column if not exists payout_amount       numeric,
  add column if not exists payout_bank_account text,
  add column if not exists payout_date         timestamptz;
