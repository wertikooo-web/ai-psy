import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/data/notebook";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const entries = await getEntries();
    return NextResponse.json(entries);
  } catch (err) {
    console.error("[notebook GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    const entry = await addEntry({ id: randomUUID(), text, createdAt: new Date().toISOString() });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[notebook POST]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
