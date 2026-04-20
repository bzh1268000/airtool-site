-- Add suburb and city to tools table
alter table tools
  add column if not exists suburb text,
  add column if not exists city   text;
