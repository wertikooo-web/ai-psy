import { NextRequest, NextResponse } from "next/server";
import { deleteEntry, updateEntry, updateEntryAttentionStatus } from "@/lib/data/notebook";
import type { NoteAttentionStatus } from "@/lib/notebookStore";

const ATTENTION_STATUSES: NoteAttentionStatus[] = ["none", "later", "important", "urgent", "done"];

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
    if (typeof body.attentionStatus === "string") {
      if (!ATTENTION_STATUSES.includes(body.attentionStatus as NoteAttentionStatus)) {
        return NextResponse.json({ error: "invalid attention status" }, { status: 400 });
      }
      const entry = await updateEntryAttentionStatus(id, body.attentionStatus as NoteAttentionStatus);
      if (!entry) return NextResponse.json({ error: "Р—Р°РїРёСЃСЊ РЅРµ РЅР°Р№РґРµРЅР°" }, { status: 404 });
      return NextResponse.json(entry);
    }
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
