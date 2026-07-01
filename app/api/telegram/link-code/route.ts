import { NextResponse } from "next/server";
import { createTelegramLinkCode } from "@/lib/data/telegramLinks";

export async function POST() {
  try {
    const result = await createTelegramLinkCode();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось создать код Telegram";
    console.error("[telegram/link-code POST]", message);
    return NextResponse.json(
      { error: message.includes("Supabase") ? "Supabase не настроен для Telegram" : "Не удалось создать код Telegram" },
      { status: 500 },
    );
  }
}
