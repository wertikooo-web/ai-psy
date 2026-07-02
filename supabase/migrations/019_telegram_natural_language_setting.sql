-- 019_telegram_natural_language_setting.sql
-- Per-profile Telegram switch for ordinary LLM phrases.

alter table public.telegram_accounts
  add column if not exists natural_language_enabled boolean not null default true;
