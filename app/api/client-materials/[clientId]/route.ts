import { NextRequest, NextResponse } from "next/server";
import { getMaterialsForClient, addMaterial } from "@/lib/data/clientMaterials";
import type { MaterialType } from "@/lib/types";
import { MATERIAL_TYPE_LABELS } from "@/lib/types";
import { randomUUID } from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const items = await getMaterialsForClient(clientId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[client-materials GET]", err);
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
    const type: MaterialType = body.type ?? "other";
    const content: string    = (body.content ?? "").trim();

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
