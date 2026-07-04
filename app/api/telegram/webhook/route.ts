import { NextRequest, NextResponse } from "next/server";
import { handleTelegramMessage, handleTelegramSettingsCallback, handleHelpCallback } from "@/lib/telegram/commands";
import { handleTelegramAudioCallback } from "@/lib/telegram/audioFlow";
import { handleTelegramNoteCallback } from "@/lib/telegram/search";
import { markTelegramUpdateProcessed } from "@/lib/data/telegramUpdates";
import type { TelegramUpdate } from "@/lib/telegram/bot";

function validateSecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

function telegramMessageTypes(update: TelegramUpdate): string {
  const message = update.message;
  if (!message) return update.callback_query ? "callback_query" : "unknown";
  const types = [
    message.text ? "text" : "",
    message.voice ? "voice" : "",
    message.audio ? "audio" : "",
    message.video_note ? "video_note" : "",
    message.document ? "document" : "",
  ].filter(Boolean);
  return types.join(",") || "message";
}

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const firstDelivery = await markTelegramUpdateProcessed(update.update_id);
    if (!firstDelivery) return NextResponse.json({ ok: true, duplicate: true });

    console.info(`[telegram/webhook] update=${update.update_id} type=${telegramMessageTypes(update)}`);

    if (update.callback_query) {
      const handled =
        (await handleHelpCallback(update.callback_query)) ||
        (await handleTelegramSettingsCallback(update.callback_query)) ||
        (await handleTelegramNoteCallback(update.callback_query));
      if (!handled) await handleTelegramAudioCallback(update.callback_query);
    }
    if (update.message) {
      await handleTelegramMessage(update.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Telegram update failed";
    console.error("[telegram/webhook POST]", message);
  }

  return NextResponse.json({ ok: true });
}
