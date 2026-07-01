import { NextResponse } from "next/server";
import { getActiveTelegramAccount } from "@/lib/data/telegramLinks";
import { getCurrentProfileId } from "@/lib/telegram/profile";

export async function GET() {
  try {
    const profileId = await getCurrentProfileId();
    const account = await getActiveTelegramAccount(profileId);
    return NextResponse.json({
      connected: Boolean(account),
      account: account
        ? {
          telegramUsername: account.telegramUsername,
          telegramFirstName: account.telegramFirstName,
          telegramLastName: account.telegramLastName,
          linkedAt: account.linkedAt,
        }
        : null,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось проверить Telegram";
    console.error("[telegram/status GET]", message);
    return NextResponse.json({ error: "Не удалось проверить Telegram" }, { status: 500 });
  }
}
