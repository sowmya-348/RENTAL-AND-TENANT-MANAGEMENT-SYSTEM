-- Rental Property and Tenant Management System
-- Run this whole file once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists btree_gist;   -- needed to stop overlapping leases

create table if not exists properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  address     text not null,
  type        text not null check (type in ('Apartment','House','Villa','Shop','Office','Room/PG')),
  market_rent numeric(12,2) not null default 0 check (market_rent >= 0),
  created_at  timestamptz not null default now()
);

create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  phone      text not null,
  email      text,
  id_proof   text,
  created_at timestamptz not null default now()
);

create table if not exists leases (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete restrict,
  tenant_id   uuid not null references tenants(id)    on delete restrict,
  start_date  date not null,
  end_date    date not null,
  rent        numeric(12,2) not null check (rent >= 0),
  due_day     int  not null check (due_day between 1 and 31),
  deposit     numeric(12,2) not null default 0 check (deposit >= 0),
  created_at  timestamptz not null default now(),
  check (end_date > start_date),
  -- one property cannot have two leases that overlap in time
  exclude using gist (property_id with =, daterange(start_date, end_date, '[]') with &&)
);

create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  lease_id   uuid not null references leases(id) on delete cascade,
  month      text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- e.g. 2026-10
  amount     numeric(12,2) not null check (amount > 0),
  paid_on    date not null,
  method     text not null check (method in ('UPI','Bank transfer','Cash','Cheque')),
  created_at timestamptz not null default now()
);

create index if not exists idx_leases_property on leases(property_id);
create index if not exists idx_leases_tenant   on leases(tenant_id);
create index if not exists idx_leases_end      on leases(end_date);
create index if not exists idx_payments_lease  on payments(lease_id, month);

-- Security: block direct browser access to the tables.
-- Only our Node.js server (which uses the service-role key) can read/write them.
alter table properties enable row level security;
alter table tenants    enable row level security;
alter table leases     enable row level security;
alter table payments   enable row level security;
