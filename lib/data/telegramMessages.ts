import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export type TelegramMessageType = "text" | "voice";
export type TelegramMessageStatus = "new" | "processed" | "archived";

export interface TelegramInboxMessage {
  id: string;
  profileId: string;
  telegramId: number;
  telegramChatId: number;
  telegramMessageId: number;
  messageType: TelegramMessageType;
  text: string | null;
  status: TelegramMessageStatus;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToMessage(row: Record<string, unknown>): TelegramInboxMessage {
  return {
    id:                 row.id as string,
    profileId:          row.profile_id as string,
    telegramId:         Number(row.telegram_id),
    telegramChatId:     Number(row.telegram_chat_id),
    telegramMessageId:  Number(row.telegram_message_id),
    messageType:        row.message_type as TelegramMessageType,
    text:               (row.text as string | null) ?? null,
    status:             row.status as TelegramMessageStatus,
    clientId:           (row.client_id as string | null) ?? null,
    createdAt:          row.created_at as string,
    updatedAt:          row.updated_at as string,
  };
}

export async function saveTelegramMessage(input: {
  profileId: string;
  telegramId: number;
  telegramChatId: number;
  telegramMessageId: number;
  messageType: TelegramMessageType;
  text?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // Always use PROF_DEV_USER_ID as the canonical profile id so the value
  // matches user_profile.id regardless of what telegram_links stores.
  const profileId = process.env.PROF_DEV_USER_ID ?? input.profileId;
  const { error } = await supabaseServer!
    .from("telegram_messages")
    .insert({
      profile_id:          profileId,
      telegram_id:         input.telegramId,
      telegram_chat_id:    input.telegramChatId,
      telegram_message_id: input.telegramMessageId,
      message_type:        input.messageType,
      text:                input.text ?? null,
      status:              "new",
    });
  if (error) {
    console.error("[DAL/saveTelegramMessage]", error.message, { profileId });
  }
}

export async function getTelegramMessages(
  profileId: string,
  opts: { status?: TelegramMessageStatus; limit?: number } = {},
): Promise<{ items: TelegramInboxMessage[]; total: number }> {
  if (!isSupabaseConfigured()) return { items: [], total: 0 };

  let query = supabaseServer!
    .from("telegram_messages")
    .select("*", { count: "exact" })
    .eq("profile_id", profileId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`[DAL/getTelegramMessages] ${error.message}`);

  return {
    items: (data ?? []).map((r) => rowToMessage(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function updateTelegramMessage(
  id: string,
  patch: Partial<Pick<TelegramInboxMessage, "status" | "clientId">>,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const row: Record<string, unknown> = {};
  if ("status" in patch)   row.status    = patch.status;
  if ("clientId" in patch) row.client_id = patch.clientId ?? null;

  const { error } = await supabaseServer!
    .from("telegram_messages")
    .update(row)
    .eq("id", id);

  if (error) throw new Error(`[DAL/updateTelegramMessage] ${error.message}`);
}
