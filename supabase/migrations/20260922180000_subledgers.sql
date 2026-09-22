-- Subsidiary ledgers for AR, AP, and Fixed Assets.
-- Control accounts live in `accounts` (tagged via subledger).
-- Detail lives in customers / vendors / fixed_assets + subledger_postings.
-- Every subledger posting references a balanced journal_entries row in the GL.

alter table public.accounts
  add column if not exists subledger text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_subledger_check'
  ) then
    alter table public.accounts
      add constraint accounts_subledger_check
      check (subledger is null or subledger in ('ar', 'ap', 'fa', 'fa_accum'));
  end if;
end $$;

create unique index if not exists accounts_user_subledger_unique
  on public.accounts (user_id, subledger)
  where subledger is not null;

alter table public.journal_entries
  add column if not exists source text not null default 'manual';

alter table public.journal_entries
  add column if not exists source_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'journal_entries_source_check'
  ) then
    alter table public.journal_entries
      add constraint journal_entries_source_check
      check (source in ('manual', 'ar', 'ap', 'fa'));
  end if;
end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  asset_tag text,
  acquisition_date date not null,
  cost numeric not null check (cost >= 0),
  salvage_value numeric not null default 0 check (salvage_value >= 0),
  useful_life_months integer not null check (useful_life_months > 0),
  status text not null default 'active'
    check (status in ('active', 'disposed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.subledger_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subledger text not null check (subledger in ('ar', 'ap', 'fa')),
  kind text not null,
  posting_date date not null,
  description text not null,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  customer_id uuid references public.customers (id) on delete restrict,
  vendor_id uuid references public.vendors (id) on delete restrict,
  asset_id uuid references public.fixed_assets (id) on delete restrict,
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint subledger_postings_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  ),
  constraint subledger_postings_party_check check (
    (subledger = 'ar' and customer_id is not null and vendor_id is null and asset_id is null)
    or (subledger = 'ap' and vendor_id is not null and customer_id is null and asset_id is null)
    or (subledger = 'fa' and asset_id is not null and customer_id is null and vendor_id is null)
  ),
  constraint subledger_postings_kind_check check (
    kind in (
      'invoice',
      'payment',
      'bill',
      'disbursement',
      'acquisition',
      'depreciation',
      'disposal'
    )
  )
);

create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists vendors_user_id_idx on public.vendors (user_id);
create index if not exists fixed_assets_user_id_idx on public.fixed_assets (user_id);
create index if not exists subledger_postings_user_subledger_idx
  on public.subledger_postings (user_id, subledger, posting_date);
create index if not exists subledger_postings_customer_idx
  on public.subledger_postings (customer_id);
create index if not exists subledger_postings_vendor_idx
  on public.subledger_postings (vendor_id);
create index if not exists subledger_postings_asset_idx
  on public.subledger_postings (asset_id);
create index if not exists subledger_postings_entry_idx
  on public.subledger_postings (journal_entry_id);

alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.subledger_postings enable row level security;

drop policy if exists "customers_own" on public.customers;
create policy "customers_own" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vendors_own" on public.vendors;
create policy "vendors_own" on public.vendors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "fixed_assets_own" on public.fixed_assets;
create policy "fixed_assets_own" on public.fixed_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subledger_postings_own" on public.subledger_postings;
create policy "subledger_postings_own" on public.subledger_postings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
