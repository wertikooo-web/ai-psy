import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export type TelegramAudioUploadStatus =
  | "received"
  | "awaiting_client"
  | "awaiting_consultation"
  | "awaiting_confirmation"
  | "downloading"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface TelegramAudioUpload {
  id: string;
  profileId: string;
  telegramId: number;
  telegramChatId: number;
  telegramMessageId: number;
  telegramFileId: string;
  telegramFileUniqueId?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
  clientId?: string;
  consultationId?: string;
  status: TelegramAudioUploadStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  completedAt?: string;
}

export interface CreateTelegramAudioUploadInput {
  profileId: string;
  telegramId: number;
  telegramChatId: number;
  telegramMessageId: number;
  telegramFileId: string;
  telegramFileUniqueId?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  durationSeconds?: number;
}

function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required for Telegram audio uploads");
  }
}

function rowToUpload(row: Record<string, unknown>): TelegramAudioUpload {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    telegramId: Number(row.telegram_id),
    telegramChatId: Number(row.telegram_chat_id),
    telegramMessageId: Number(row.telegram_message_id),
    telegramFileId: row.telegram_file_id as string,
    telegramFileUniqueId: (row.telegram_file_unique_id as string | null) ?? undefined,
    originalFilename: (row.original_filename as string | null) ?? undefined,
    mimeType: (row.mime_type as string | null) ?? undefined,
    fileSize: row.file_size == null ? undefined : Number(row.file_size),
    durationSeconds: row.duration_seconds == null ? undefined : Number(row.duration_seconds),
    clientId: (row.client_id as string | null) ?? undefined,
    consultationId: (row.consultation_id as string | null) ?? undefined,
    status: row.status as TelegramAudioUploadStatus,
    errorMessage: (row.error_message as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    confirmedAt: (row.confirmed_at as string | null) ?? undefined,
    completedAt: (row.completed_at as string | null) ?? undefined,
  };
}

export async function createTelegramAudioUpload(input: CreateTelegramAudioUploadInput): Promise<TelegramAudioUpload> {
  ensureSupabase();
  const existingMessage = await getTelegramAudioUploadByMessage(input.profileId, input.telegramChatId, input.telegramMessageId);
  if (existingMessage && existingMessage.status !== "cancelled" && existingMessage.status !== "failed" && existingMessage.status !== "expired") {
    return existingMessage;
  }

  if (input.telegramFileUniqueId) {
    const existing = await getTelegramAudioUploadByUniqueFile(input.profileId, input.telegramFileUniqueId);
    if (existing && existing.status !== "cancelled" && existing.status !== "failed" && existing.status !== "expired") {
      return existing;
    }
  }

  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .insert({
      profile_id: input.profileId,
      telegram_id: input.telegramId,
      telegram_chat_id: input.telegramChatId,
      telegram_message_id: input.telegramMessageId,
      telegram_file_id: input.telegramFileId,
      telegram_file_unique_id: input.telegramFileUniqueId ?? null,
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType ?? null,
      file_size: input.fileSize ?? null,
      duration_seconds: input.durationSeconds ?? null,
      status: "awaiting_client",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const fallback =
        (input.telegramFileUniqueId ? await getTelegramAudioUploadByUniqueFile(input.profileId, input.telegramFileUniqueId) : null) ??
        await getTelegramAudioUploadByMessage(input.profileId, input.telegramChatId, input.telegramMessageId);
      if (fallback) return fallback;
    }
    throw new Error(`[DAL/createTelegramAudioUpload] ${error.message}`);
  }
  return rowToUpload(data as Record<string, unknown>);
}

export async function getTelegramAudioUpload(id: string): Promise<TelegramAudioUpload | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`[DAL/getTelegramAudioUpload] ${error.message}`);
  return data ? rowToUpload(data as Record<string, unknown>) : null;
}

export async function getTelegramAudioUploadByIdPrefix(idPrefix: string): Promise<TelegramAudioUpload | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .select("*")
    .like("id", `${idPrefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`[DAL/getTelegramAudioUploadByIdPrefix] ${error.message}`);
  const first = data?.[0];
  return first ? rowToUpload(first as Record<string, unknown>) : null;
}

export async function getTelegramAudioUploadByUniqueFile(
  profileId: string,
  fileUniqueId: string,
): Promise<TelegramAudioUpload | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .select("*")
    .eq("profile_id", profileId)
    .eq("telegram_file_unique_id", fileUniqueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`[DAL/getTelegramAudioUploadByUniqueFile] ${error.message}`);
  return data ? rowToUpload(data as Record<string, unknown>) : null;
}

export async function getTelegramAudioUploadByMessage(
  profileId: string,
  chatId: number,
  messageId: number,
): Promise<TelegramAudioUpload | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .select("*")
    .eq("profile_id", profileId)
    .eq("telegram_chat_id", chatId)
    .eq("telegram_message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`[DAL/getTelegramAudioUploadByMessage] ${error.message}`);
  return data ? rowToUpload(data as Record<string, unknown>) : null;
}

export async function updateTelegramAudioUpload(
  id: string,
  patch: Partial<Pick<TelegramAudioUpload, "clientId" | "consultationId" | "status" | "errorMessage" | "confirmedAt" | "completedAt">>,
): Promise<TelegramAudioUpload> {
  ensureSupabase();
  const row: Record<string, unknown> = {};
  if ("clientId" in patch) row.client_id = patch.clientId ?? null;
  if ("consultationId" in patch) row.consultation_id = patch.consultationId ?? null;
  if ("status" in patch) row.status = patch.status;
  if ("errorMessage" in patch) row.error_message = patch.errorMessage ?? null;
  if ("confirmedAt" in patch) row.confirmed_at = patch.confirmedAt ?? null;
  if ("completedAt" in patch) row.completed_at = patch.completedAt ?? null;

  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`[DAL/updateTelegramAudioUpload] ${error.message}`);
  return rowToUpload(data as Record<string, unknown>);
}

export async function claimTelegramAudioUpload(uploadId: string): Promise<TelegramAudioUpload | null> {
  ensureSupabase();
  const { data, error } = await supabaseServer!
    .from("telegram_audio_uploads")
    .update({ status: "downloading" })
    .eq("id", uploadId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`[DAL/claimTelegramAudioUpload] ${error.message}`);
  return data ? rowToUpload(data as Record<string, unknown>) : null;
}
