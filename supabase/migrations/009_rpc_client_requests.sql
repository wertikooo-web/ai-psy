-- Migration 009: PostgreSQL RPC functions for atomic client_requests operations.
--
-- Supabase JS client does not support multi-statement transactions.
-- These functions run inside a single DB transaction, ensuring:
--   • at most one is_current=true per client at all times
--   • no race window between "unset old current" and "set new current"

-- ── 1. Switch current request atomically ─────────────────────────────────────
-- Used by setCurrentClientRequest() DAL function.
-- Clears existing current, sets the given request as current.
-- Raises if the request does not belong to this client or is soft-deleted.

create or replace function public.set_current_client_request(
  p_client_id  uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  -- Validate ownership before touching anything
  if not exists (
    select 1 from public.client_requests
    where id = p_request_id
      and client_id = p_client_id
      and deleted_at is null
  ) then
    raise exception 'client_request % not found or does not belong to client %',
      p_request_id, p_client_id;
  end if;

  -- Unset any existing current (same client)
  update public.client_requests
    set is_current = false
  where client_id  = p_client_id
    and is_current = true
    and deleted_at is null
    and id        != p_request_id;

  -- Set the target as current
  update public.client_requests
    set is_current = true
  where id = p_request_id;
end;
$$;

-- ── 2. Create a new request and immediately make it current ──────────────────
-- Used by createClientRequest(input, makeCurrent=true) DAL function.
-- Inserts the new record and swaps is_current in one transaction.
-- Returns the new request id.

create or replace function public.create_current_client_request(
  p_client_id              uuid,
  p_text                   text,
  p_source                 text,
  p_origin_consultation_id uuid    default null,
  p_comment                text    default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  -- Validate source
  if p_source not in ('initial', 'edit', 'new_request') then
    raise exception 'invalid source value: %', p_source;
  end if;

  -- Validate text
  if trim(p_text) = '' then
    raise exception 'request text must not be empty';
  end if;

  -- Unset existing current
  update public.client_requests
    set is_current = false
  where client_id  = p_client_id
    and is_current = true
    and deleted_at is null;

  -- Insert new current request
  insert into public.client_requests
    (client_id, text, is_current, source, origin_consultation_id, comment)
  values
    (p_client_id, trim(p_text), true, p_source, p_origin_consultation_id, p_comment)
  returning id into v_new_id;

  return v_new_id;
end;
$$;
