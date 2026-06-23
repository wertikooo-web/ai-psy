import { NextRequest, NextResponse } from "next/server";
import { getForClient, addMaterial } from "@/lib/clientMaterialsStore";
import type { MaterialType } from "@/lib/types";
import { MATERIAL_TYPE_LABELS } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const items = await getForClient(clientId);
  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const type: MaterialType  = body.type ?? "other";
    const content: string     = (body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "content обязателен" }, { status: 400 });

    const material = {
      id:        randomUUID(),
      clientId,
      type,
      title:     (body.title ?? "").trim() || MATERIAL_TYPE_LABELS[type],
      content,
      fileName:  body.fileName ?? undefined,
      fileUrl:   body.fileUrl  ?? undefined,
      createdAt: new Date().toISOString(),
    };

    await addMaterial(material);
    return NextResponse.json(material, { status: 201 });
  } catch (err) {
    console.error("[client-materials POST]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
