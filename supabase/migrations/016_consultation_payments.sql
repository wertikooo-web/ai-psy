-- 016_consultation_payments.sql
-- Payments are attached to consultations. Analytics reads only real saved rows.

create table if not exists public.consultation_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz default null,
  client_id uuid references public.clients(id) on delete set null,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  charged_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid',
  payment_date date,
  comment text,
  constraint consultation_payments_status_check
    check (payment_status in ('unpaid', 'partial', 'paid', 'free', 'cancelled'))
);

drop trigger if exists consultation_payments_updated_at on public.consultation_payments;
create trigger consultation_payments_updated_at
  before update on public.consultation_payments
  for each row
  execute function public.set_updated_at();

alter table public.consultation_payments enable row level security;

create unique index if not exists consultation_payments_consultation_active_uidx
  on public.consultation_payments (consultation_id)
  where deleted_at is null;

create index if not exists consultation_payments_deleted_at_idx
  on public.consultation_payments (deleted_at)
  where deleted_at is null;

create index if not exists consultation_payments_client_id_idx
  on public.consultation_payments (client_id)
  where deleted_at is null;

create index if not exists consultation_payments_payment_date_idx
  on public.consultation_payments (payment_date)
  where deleted_at is null;

create index if not exists consultation_payments_status_idx
  on public.consultation_payments (payment_status)
  where deleted_at is null;

