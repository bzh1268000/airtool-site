-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the disputes table for the rental lifecycle dispute system

create table if not exists disputes (
  id              serial primary key,
  booking_id      integer references bookings(id) on delete cascade,
  owner_email     text,
  renter_email    text,
  reason          text not null,
  amount_claimed  numeric(10,2),
  status          text not null default 'open',   -- open | resolved | escalated
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolution      text,   -- release_to_owner | partial_refund | full_refund
  admin_notes     text
);

-- Index for fast lookup by booking
create index if not exists disputes_booking_id_idx on disputes(booking_id);

-- RLS: service role can do everything; authenticated users can read their own disputes
alter table disputes enable row level security;

create policy "service_role_all" on disputes
  for all using (true)
  with check (true);

-- Optional: allow owners/renters to view their own disputes
create policy "parties_can_read_own" on disputes
  for select
  using (
    owner_email  = auth.jwt() ->> 'email'
    or renter_email = auth.jwt() ->> 'email'
  );
