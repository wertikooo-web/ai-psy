import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENAI_API_KEY ?? "";
  const configured = key.length > 10;
  const masked = configured
    ? key.slice(0, 7) + "..." + key.slice(-4)
    : null;
  return NextResponse.json({ configured, masked });
}

export async function POST() {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY не установлен" });
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
