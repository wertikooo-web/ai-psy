/**
 * DAL - Telegram account linking. SERVER ONLY.
 * Stores one-time codes as hashes and keeps Telegram access separated from clinical data.
 */

import { createHash, randomInt } from "crypto";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { DEFAULT_PROFILE_ID, getCurrentProfileId } from "@/lib/telegram/profile";

export interface TelegramAccount {
  id: string;
  profileId: string;
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  naturalLanguageEnabled: boolean;
  linkedAt: string;
  disabledAt?: string;
}

export interface TelegramLinkCode {
  code: string;
  expiresAt: string;
}

export type TelegramLinkResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: "invalid" | "used" | "expired" | "already_linked" | "rate_limited" | "not_configured" };

export interface TelegramIdentity {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const LINK_ATTEMPT_LIMIT = 5;
const LINK_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const linkAttempts = new Map<number, number[]>();

function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required for Telegram linking");
  }
}

function codePepper() {
  const pepper =
    process.env.TELEGRAM_LINK_CODE_PEPPER ||
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!pepper) throw new Error("Telegram code hashing secret is not configured");
  return pepper;
}

export function hashTelegramLinkCode(code: string): string {
  return createHash("sha256")
    .update(`${code}:${codePepper()}`)
    .digest("hex");
}

function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function rowToAccount(row: Record<string, unknown>): TelegramAccount {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    telegramId: Number(row.telegram_id),
    telegramUsername: (row.telegram_username as string | null) ?? undefined,
    telegramFirstName: (row.telegram_first_name as string | null) ?? undefined,
    telegramLastName: (row.telegram_last_name as string | null) ?? undefined,
    naturalLanguageEnabled: row.natural_language_enabled !== false,
    linkedAt: row.linked_at as string,
    disabledAt: (row.disabled_at as string | null) ?? undefined,
  };
}

function isRateLimited(telegramId: number): boolean {
  const now = Date.now();
  const recent = (linkAttempts.get(telegramId) ?? []).filter((time) => now - time < LINK_ATTEMPT_WINDOW_MS);
  linkAttempts.set(telegramId, recent);
  return recent.length >= LINK_ATTEMPT_LIMIT;
}

function recordFailedAttempt(telegramId: number) {
  const now = Date.now();
  const recent = (linkAttempts.get(telegramId) ?? []).filter((time) => now - time < LINK_ATTEMPT_WINDOW_MS);
  recent.push(now);
  linkAttempts.set(telegramId, recent);
}

function clearAttempts(telegramId: number) {
  linkAttempts.delete(telegramId);
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  ensureSupabase();
  const profileId = await getCurrentProfileId();
  const code = generateSixDigitCode();
  const codeHash = hashTelegramLinkCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  await supabaseServer!
    .from("telegram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("used_at", null);

  const { error } = await supabaseServer!
    .from("telegram_link_codes")
    .insert({
      profile_id: profileId,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

  if (error) throw new Error(`[DAL/createTelegramLinkCode] ${error.message}`);
  return { code, expiresAt };
}

export async function getActiveTelegramAccount(profileId = DEFAULT_PROFILE_ID): Promise<TelegramAccount | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_accounts")
    .select("*")
    .eq("profile_id", profileId)
    .is("disabled_at", null)
    .maybeSingle();

  if (error) throw new Error(`[DAL/getActiveTelegramAccount] ${error.message}`);
  return data ? rowToAccount(data as Record<string, unknown>) : null;
}

export async function findTelegramAccountByTelegramId(telegramId: number): Promise<TelegramAccount | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_accounts")
    .select("*")
    .eq("telegram_id", telegramId)
    .is("disabled_at", null)
    .maybeSingle();

  if (error) throw new Error(`[DAL/findTelegramAccountByTelegramId] ${error.message}`);
  return data ? rowToAccount(data as Record<string, unknown>) : null;
}

export async function setTelegramNaturalLanguageEnabled(telegramId: number, enabled: boolean): Promise<TelegramAccount> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_accounts")
    .update({ natural_language_enabled: enabled })
    .eq("telegram_id", telegramId)
    .is("disabled_at", null)
    .select("*")
    .single();

  if (error) throw new Error(`[DAL/setTelegramNaturalLanguageEnabled] ${error.message}`);
  return rowToAccount(data as Record<string, unknown>);
}

export async function linkTelegramAccount(code: string, identity: TelegramIdentity): Promise<TelegramLinkResult> {
  ensureSupabase();
  if (!/^\d{6}$/.test(code)) {
    recordFailedAttempt(identity.id);
    return { ok: false, reason: "invalid" };
  }
  if (isRateLimited(identity.id)) return { ok: false, reason: "rate_limited" };

  const codeHash = hashTelegramLinkCode(code);
  const { data, error } = await supabaseServer!.rpc("link_telegram_account", {
    p_code_hash: codeHash,
    p_telegram_id: identity.id,
    p_telegram_username: identity.username ?? null,
    p_telegram_first_name: identity.firstName ?? null,
    p_telegram_last_name: identity.lastName ?? null,
  });

  if (error) throw new Error(`[DAL/linkTelegramAccount] ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status as string | undefined;
  const profileId = row?.profile_id as string | null | undefined;

  if (status === "linked" && profileId) {
    clearAttempts(identity.id);
    return { ok: true, profileId };
  }

  recordFailedAttempt(identity.id);
  if (status === "used") return { ok: false, reason: "used" };
  if (status === "expired") return { ok: false, reason: "expired" };
  if (status === "profile_already_linked" || status === "telegram_already_linked") {
    return { ok: false, reason: "already_linked" };
  }
  return { ok: false, reason: "invalid" };
}

export async function disconnectTelegram(profileId = DEFAULT_PROFILE_ID): Promise<void> {
  ensureSupabase();
  const now = new Date().toISOString();
  const [accountResult, codesResult] = await Promise.all([
    supabaseServer!
      .from("telegram_accounts")
      .update({ disabled_at: now })
      .eq("profile_id", profileId)
      .is("disabled_at", null),
    supabaseServer!
      .from("telegram_link_codes")
      .update({ used_at: now })
      .eq("profile_id", profileId)
      .is("used_at", null),
  ]);

  if (accountResult.error) throw new Error(`[DAL/disconnectTelegram/account] ${accountResult.error.message}`);
  if (codesResult.error) throw new Error(`[DAL/disconnectTelegram/codes] ${codesResult.error.message}`);
}
