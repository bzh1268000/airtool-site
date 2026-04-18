-- Run in Supabase SQL editor

-- 1. Add commission column to tool_sales (stores the fee amount at time of sale)
alter table tool_sales
  add column if not exists platform_commission numeric not null default 0;

-- 2. Insert default sale commission rate (10%) into platform_settings
insert into platform_settings (key, value)
values ('sale_commission_pct', '10')
on conflict (key) do nothing;
