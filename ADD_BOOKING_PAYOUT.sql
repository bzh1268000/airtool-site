-- Run in Supabase SQL editor
alter table bookings
  add column if not exists payout_status       text not null default 'pending',
  add column if not exists payout_amount       numeric,
  add column if not exists payout_bank_account text,
  add column if not exists payout_date         timestamptz,
  add column if not exists payout_note         text;
