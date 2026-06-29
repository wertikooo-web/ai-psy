import { NextResponse } from "next/server";
import { addMaterial } from "@/lib/data/clientMaterials";
import { getEntryById } from "@/lib/data/notebook";
import { randomUUID } from "crypto";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const entry = await getEntryById(id);
    if (!entry) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    if (!entry.clientId) return NextResponse.json({ error: "Сначала свяжите запись с клиентом" }, { status: 400 });

    const material = {
      id:        randomUUID(),
      clientId:  entry.clientId,
      type:      "therapist_notes" as const,
      title:     entry.title || "Запись из блокнота психолога",
      content:   entry.text,
      createdAt: new Date().toISOString(),
    };

    await addMaterial(material);
    return NextResponse.json(material, { status: 201 });
  } catch (err) {
    console.error("[notebook/material POST]", err);
    return NextResponse.json({ error: "Ошибка добавления в материалы" }, { status: 500 });
  }
}
