-- Run in Supabase SQL Editor: adds raised_by column to disputes table
-- Values: 'owner' | 'renter'
alter table disputes
  add column if not exists raised_by text not null default 'owner';
