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
  select tlc.*
    into v_code
    from public.telegram_link_codes tlc
   where tlc.code_hash = p_code_hash
   order by tlc.created_at desc
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

  select ta.*
    into v_existing
    from public.telegram_accounts ta
   where ta.telegram_id = p_telegram_id
     and ta.disabled_at is null
   limit 1
   for update;

  if found and v_existing.profile_id <> v_code.profile_id then
    return query select 'telegram_already_linked'::text, v_existing.profile_id;
    return;
  end if;

  if exists (
    select 1
      from public.telegram_accounts ta
     where ta.profile_id = v_code.profile_id
       and ta.telegram_id <> p_telegram_id
       and ta.disabled_at is null
  ) then
    return query select 'profile_already_linked'::text, v_code.profile_id;
    return;
  end if;

  update public.telegram_accounts ta
     set disabled_at = now()
   where ta.profile_id = v_code.profile_id
     and ta.telegram_id <> p_telegram_id
     and ta.disabled_at is null;

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

  update public.telegram_link_codes tlc
     set used_at = now(),
         telegram_id = p_telegram_id
   where tlc.id = v_code.id;

  update public.telegram_link_codes tlc
     set used_at = now()
   where tlc.profile_id = v_code.profile_id
     and tlc.id <> v_code.id
     and tlc.used_at is null;

  return query select 'linked'::text, v_code.profile_id;
end;
$$;

revoke all on function public.link_telegram_account(text, bigint, text, text, text) from public;
grant execute on function public.link_telegram_account(text, bigint, text, text, text) to service_role;
