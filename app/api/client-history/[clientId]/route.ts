import { NextRequest, NextResponse } from "next/server";
import { getHistoryForClient, addHistoryItem } from "@/lib/data/clientHistory";
import type { HistorySection } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const items = await getHistoryForClient(clientId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[client-history GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const text: string = (body.text ?? "").trim();
    const section: HistorySection = body.section;
    if (!text)    return NextResponse.json({ error: "text обязателен" }, { status: 400 });
    if (!section) return NextResponse.json({ error: "section обязателен" }, { status: 400 });

    const item = {
      id:        randomUUID(),
      clientId,
      section,
      text,
      source:    (body.source === "ai" ? "ai" : "manual") as "ai" | "manual",
      sessionId: body.sessionId ?? undefined,
      createdAt: new Date().toISOString(),
    };

    await addHistoryItem(item);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[client-history POST]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
