-- 017_telegram_links.sql
-- First Telegram integration stage: secure one-time linking to the current app profile.
-- The app is still single-user, so profile_id currently points to user_profile.id = 'default'.

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.user_profile(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  telegram_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.user_profile(id) on delete cascade,
  telegram_id bigint not null unique,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  linked_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_audio_uploads (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.user_profile(id) on delete cascade,
  telegram_id bigint not null,
  telegram_chat_id bigint not null,
  telegram_message_id bigint not null,
  telegram_file_id text not null,
  telegram_file_unique_id text,
  original_filename text,
  mime_type text,
  file_size bigint,
  duration_seconds integer,
  client_id uuid references public.clients(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  constraint telegram_audio_uploads_status_check
    check (status in (
      'received',
      'awaiting_client',
      'awaiting_consultation',
      'awaiting_confirmation',
      'downloading',
      'uploading',
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
      'expired'
    ))
);

create table if not exists public.telegram_processed_updates (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);

drop trigger if exists telegram_accounts_updated_at on public.telegram_accounts;
create trigger telegram_accounts_updated_at
  before update on public.telegram_accounts
  for each row
  execute function public.set_updated_at();

drop trigger if exists telegram_audio_uploads_updated_at on public.telegram_audio_uploads;
create trigger telegram_audio_uploads_updated_at
  before update on public.telegram_audio_uploads
  for each row
  execute function public.set_updated_at();

create index if not exists telegram_link_codes_code_hash_idx
  on public.telegram_link_codes (code_hash);

create index if not exists telegram_link_codes_profile_id_idx
  on public.telegram_link_codes (profile_id);

create index if not exists telegram_link_codes_expires_at_idx
  on public.telegram_link_codes (expires_at);

create index if not exists telegram_accounts_telegram_id_idx
  on public.telegram_accounts (telegram_id);

create index if not exists telegram_accounts_profile_id_idx
  on public.telegram_accounts (profile_id);

create index if not exists telegram_audio_uploads_profile_id_idx
  on public.telegram_audio_uploads (profile_id);

create index if not exists telegram_audio_uploads_telegram_id_idx
  on public.telegram_audio_uploads (telegram_id);

create index if not exists telegram_audio_uploads_status_idx
  on public.telegram_audio_uploads (status);

create index if not exists telegram_audio_uploads_file_unique_idx
  on public.telegram_audio_uploads (telegram_file_unique_id);

create unique index if not exists telegram_audio_uploads_profile_file_unique_active_uidx
  on public.telegram_audio_uploads (profile_id, telegram_file_unique_id)
  where telegram_file_unique_id is not null
    and status not in ('cancelled', 'failed', 'expired');

create unique index if not exists telegram_audio_uploads_profile_message_active_uidx
  on public.telegram_audio_uploads (profile_id, telegram_chat_id, telegram_message_id)
  where status not in ('cancelled', 'failed', 'expired');

create unique index if not exists telegram_accounts_one_active_profile_uidx
  on public.telegram_accounts (profile_id)
  where disabled_at is null;

alter table public.telegram_link_codes enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.telegram_audio_uploads enable row level security;
alter table public.telegram_processed_updates enable row level security;

-- Current backend uses service role and validates access server-side.
-- These policies intentionally do not expose data to the browser Supabase client.
drop policy if exists "telegram_link_codes_service_only" on public.telegram_link_codes;
create policy "telegram_link_codes_service_only"
  on public.telegram_link_codes
  for all
  using (false)
  with check (false);

drop policy if exists "telegram_accounts_service_only" on public.telegram_accounts;
create policy "telegram_accounts_service_only"
  on public.telegram_accounts
  for all
  using (false)
  with check (false);

drop policy if exists "telegram_audio_uploads_service_only" on public.telegram_audio_uploads;
create policy "telegram_audio_uploads_service_only"
  on public.telegram_audio_uploads
  for all
  using (false)
  with check (false);

drop policy if exists "telegram_processed_updates_service_only" on public.telegram_processed_updates;
create policy "telegram_processed_updates_service_only"
  on public.telegram_processed_updates
  for all
  using (false)
  with check (false);

create or replace function public.link_telegram_account(
  p_code_hash text,
  p_telegram_id bigint,
  p_telegram_username text default null,
  p_telegram_first_name text default null,
  p_telegram_last_name text default null
)
returns table(status text, profile_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.telegram_link_codes%rowtype;
  v_existing public.telegram_accounts%rowtype;
begin
  select *
    into v_code
    from public.telegram_link_codes
   where code_hash = p_code_hash
   order by created_at desc
   limit 1
   for update;

  if not found then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  if v_code.used_at is not null then
    return query select 'used'::text, null::text;
    return;
  end if;

  if v_code.expires_at <= now() then
    return query select 'expired'::text, null::text;
    return;
  end if;

  if not exists (select 1 from public.user_profile up where up.id = v_code.profile_id) then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select *
    into v_existing
    from public.telegram_accounts
   where telegram_id = p_telegram_id
     and disabled_at is null
   limit 1
   for update;

  if found and v_existing.profile_id <> v_code.profile_id then
    return query select 'telegram_already_linked'::text, v_existing.profile_id;
    return;
  end if;

  if exists (
    select 1
      from public.telegram_accounts
     where profile_id = v_code.profile_id
       and telegram_id <> p_telegram_id
       and disabled_at is null
  ) then
    return query select 'profile_already_linked'::text, v_code.profile_id;
    return;
  end if;

  update public.telegram_accounts
     set disabled_at = now()
   where profile_id = v_code.profile_id
     and telegram_id <> p_telegram_id
     and disabled_at is null;

  insert into public.telegram_accounts (
    profile_id,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    linked_at,
    disabled_at
  )
  values (
    v_code.profile_id,
    p_telegram_id,
    p_telegram_username,
    p_telegram_first_name,
    p_telegram_last_name,
    now(),
    null
  )
  on conflict (telegram_id)
  do update set
    profile_id = excluded.profile_id,
    telegram_username = excluded.telegram_username,
    telegram_first_name = excluded.telegram_first_name,
    telegram_last_name = excluded.telegram_last_name,
    linked_at = now(),
    disabled_at = null,
    updated_at = now();

  update public.telegram_link_codes
     set used_at = now(),
         telegram_id = p_telegram_id
   where id = v_code.id;

  update public.telegram_link_codes
     set used_at = now()
   where profile_id = v_code.profile_id
     and id <> v_code.id
     and used_at is null;

return query select 'linked'::text, v_code.profile_id;
end;
$$;

revoke all on function public.link_telegram_account(text, bigint, text, text, text) from public;
grant execute on function public.link_telegram_account(text, bigint, text, text, text) to service_role;
