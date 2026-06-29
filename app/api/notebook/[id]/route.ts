import { NextRequest, NextResponse } from "next/server";
import { deleteEntry, updateEntry } from "@/lib/data/notebook";

function splitTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    const entry = await updateEntry(id, {
      title:    body.title ?? "",
      text,
      clientId: body.clientId || undefined,
      topic:    body.topic || undefined,
      tags:     splitTags(body.tags),
    });
    if (!entry) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    return NextResponse.json(entry);
  } catch (err) {
    console.error("[notebook PATCH]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteEntry(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notebook DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
