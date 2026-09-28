-- Sales price on inventory items, and a sale posting kind.

alter table public.inventory_items
  add column if not exists sale_price numeric not null default 0;

alter table public.inventory_items
  drop constraint if exists inventory_items_sale_price_check;

alter table public.inventory_items
  add constraint inventory_items_sale_price_check
  check (sale_price >= 0);

alter table public.subledger_postings
  drop constraint if exists subledger_postings_kind_check;

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
      'wage',
      'sale'
    )
  );
