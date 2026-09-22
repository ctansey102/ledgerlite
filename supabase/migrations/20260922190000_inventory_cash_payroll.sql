-- Extend subsidiary ledgers for Inventory, Cash, and Payroll.

alter table public.accounts drop constraint if exists accounts_subledger_check;
alter table public.accounts
  add constraint accounts_subledger_check
  check (
    subledger is null
    or subledger in ('ar', 'ap', 'fa', 'fa_accum', 'inv', 'cash', 'payroll')
  );

alter table public.journal_entries drop constraint if exists journal_entries_source_check;
alter table public.journal_entries
  add constraint journal_entries_source_check
  check (source in ('manual', 'ar', 'ap', 'fa', 'inv', 'cash', 'payroll'));

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sku text not null,
  name text not null,
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.subledger_postings
  add column if not exists inventory_item_id uuid references public.inventory_items (id) on delete restrict,
  add column if not exists employee_id uuid references public.employees (id) on delete restrict,
  add column if not exists quantity numeric check (quantity is null or quantity >= 0);

alter table public.subledger_postings drop constraint if exists subledger_postings_subledger_check;
alter table public.subledger_postings
  add constraint subledger_postings_subledger_check
  check (subledger in ('ar', 'ap', 'fa', 'inv', 'cash', 'payroll'));

alter table public.subledger_postings drop constraint if exists subledger_postings_kind_check;
alter table public.subledger_postings
  add constraint subledger_postings_kind_check
  check (
    kind in (
      'invoice',
      'payment',
      'bill',
      'disbursement',
      'acquisition',
      'depreciation',
      'disposal',
      'purchase',
      'issue',
      'adjustment',
      'receipt',
      'wage'
    )
  );

alter table public.subledger_postings drop constraint if exists subledger_postings_party_check;
alter table public.subledger_postings
  add constraint subledger_postings_party_check
  check (
    (
      subledger = 'ar'
      and customer_id is not null
      and vendor_id is null
      and asset_id is null
      and inventory_item_id is null
      and employee_id is null
    )
    or (
      subledger = 'ap'
      and vendor_id is not null
      and customer_id is null
      and asset_id is null
      and inventory_item_id is null
      and employee_id is null
    )
    or (
      subledger = 'fa'
      and asset_id is not null
      and customer_id is null
      and vendor_id is null
      and inventory_item_id is null
      and employee_id is null
    )
    or (
      subledger = 'inv'
      and inventory_item_id is not null
      and customer_id is null
      and vendor_id is null
      and asset_id is null
      and employee_id is null
    )
    or (
      subledger = 'cash'
      and customer_id is null
      and vendor_id is null
      and asset_id is null
      and inventory_item_id is null
      and employee_id is null
    )
    or (
      subledger = 'payroll'
      and employee_id is not null
      and customer_id is null
      and vendor_id is null
      and asset_id is null
      and inventory_item_id is null
    )
  );

create index if not exists inventory_items_user_id_idx on public.inventory_items (user_id);
create index if not exists employees_user_id_idx on public.employees (user_id);
create index if not exists subledger_postings_inventory_idx on public.subledger_postings (inventory_item_id);
create index if not exists subledger_postings_employee_idx on public.subledger_postings (employee_id);

alter table public.inventory_items enable row level security;
alter table public.employees enable row level security;

drop policy if exists "inventory_items_own" on public.inventory_items;
create policy "inventory_items_own" on public.inventory_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "employees_own" on public.employees;
create policy "employees_own" on public.employees
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.inventory_items to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
