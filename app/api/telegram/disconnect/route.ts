import { NextResponse } from "next/server";
import { disconnectTelegram } from "@/lib/data/telegramLinks";
import { getCurrentProfileId } from "@/lib/telegram/profile";

export async function POST() {
  try {
    const profileId = await getCurrentProfileId();
    await disconnectTelegram(profileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось отключить Telegram";
    console.error("[telegram/disconnect POST]", message);
    return NextResponse.json({ error: "Не удалось отключить Telegram" }, { status: 500 });
  }
}
