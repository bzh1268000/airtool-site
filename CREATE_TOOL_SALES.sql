-- Run this in Supabase SQL editor

create table if not exists tool_sales (
  id            bigserial primary key,
  tool_id       bigint not null,
  tool_name     text,
  sale_price    numeric not null,
  buyer_email   text,
  buyer_name    text,
  owner_email   text,
  stripe_session_id text,
  payout_status text not null default 'pending',  -- pending | paid
  payout_note   text,
  paid_at       timestamptz default now(),
  created_at    timestamptz default now()
);
