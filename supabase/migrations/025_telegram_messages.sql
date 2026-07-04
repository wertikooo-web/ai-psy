-- Migration 025: telegram_messages
-- Stores all text and voice messages received by the Telegram bot so they can
-- be reviewed and processed from the web inbox instead of being lost after answering.

create table if not exists public.telegram_messages (
  id                 uuid        primary key default gen_random_uuid(),
  profile_id         text        not null references public.user_profile(id) on delete cascade,
  telegram_id        bigint      not null,
  telegram_chat_id   bigint      not null,
  telegram_message_id bigint     not null,
  message_type       text        not null,
  text               text,
  status             text        not null default 'new',
  client_id          uuid        references public.clients(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint telegram_messages_type_check
    check (message_type in ('text', 'voice')),
  constraint telegram_messages_status_check
    check (status in ('new', 'processed', 'archived'))
);

drop trigger if exists telegram_messages_updated_at on public.telegram_messages;
create trigger telegram_messages_updated_at
  before update on public.telegram_messages
  for each row
  execute function public.set_updated_at();

create index if not exists telegram_messages_profile_id_idx
  on public.telegram_messages (profile_id);

create index if not exists telegram_messages_status_idx
  on public.telegram_messages (profile_id, status);

create index if not exists telegram_messages_created_at_idx
  on public.telegram_messages (profile_id, created_at desc);

alter table public.telegram_messages enable row level security;

drop policy if exists "telegram_messages_service_only" on public.telegram_messages;
create policy "telegram_messages_service_only"
  on public.telegram_messages
  for all
  using (false)
  with check (false);
