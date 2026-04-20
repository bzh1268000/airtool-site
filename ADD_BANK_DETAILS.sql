-- Run in Supabase SQL editor
alter table profiles
  add column if not exists bank_account_name   text,
  add column if not exists bank_account_number text,
  add column if not exists bank_name           text;
