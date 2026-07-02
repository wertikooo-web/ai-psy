import { NextRequest, NextResponse } from "next/server";
import { processTelegramAudioUpload } from "@/lib/telegram/audioFlow";

export const maxDuration = 300;

function validateSecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_INTERNAL_SECRET;
  if (!expected) return false;
  return req.headers.get("x-internal-telegram-secret") === expected;
}

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  await processTelegramAudioUpload(uploadId);
  return NextResponse.json({ ok: true });
}
