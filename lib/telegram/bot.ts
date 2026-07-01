import { randomUUID } from "crypto";
import { once } from "events";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import os from "os";
import path from "path";

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  voice?: TelegramAudioLike;
  audio?: TelegramAudioLike;
  document?: TelegramDocumentLike;
  chat: {
    id: number;
    type: string;
  };
  from?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramAudioLike {
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface TelegramDocumentLike {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramFileInfo {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboardButton[][] },
): Promise<void> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.status}`);
  }
}

export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboardButton[][] },
): Promise<void> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram editMessageText failed: ${res.status}`);
  }
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string): Promise<void> {
  const token = getTelegramBotToken();
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    }),
  }).catch(() => {});
}

export async function getTelegramFile(fileId: string): Promise<TelegramFileInfo> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) throw new Error(`Telegram getFile failed: ${res.status}`);
  const body = await res.json();
  if (!body.ok || !body.result?.file_path) throw new Error("Telegram file is unavailable");
  return body.result as TelegramFileInfo;
}

export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function downloadTelegramFileToTemp(filePath: string): Promise<string> {
  const token = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  if (!res.body) throw new Error("Telegram file download stream is empty");

  const dir = path.join(os.tmpdir(), "transcript-ai-telegram");
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${Date.now()}-${randomUUID()}`);
  const reader = res.body.getReader();
  const file = createWriteStream(tempPath);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!file.write(value)) await once(file, "drain");
    }
    file.end();
    await once(file, "finish");
  } catch (err) {
    file.destroy();
    throw err;
  } finally {
    reader.releaseLock();
  }
  return tempPath;
}

export function parseTelegramCommand(text: string | undefined): { command: string; args: string } | null {
  if (!text?.startsWith("/")) return null;
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();
  return { command, args: rest.join(" ").trim() };
}
