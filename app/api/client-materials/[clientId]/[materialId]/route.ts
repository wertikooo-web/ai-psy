import { NextRequest, NextResponse } from "next/server";
import { deleteMaterial, updateMaterial } from "@/lib/data/clientMaterials";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; materialId: string }> }
) {
  const { materialId } = await params;
  try {
    const body    = await req.json();
    const updates: Record<string, string> = {};
    if (body.content !== undefined) updates.content = String(body.content);
    if (body.title   !== undefined) updates.title   = String(body.title);
    const updated = await updateMaterial(materialId, updates);
    if (!updated) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[client-materials PATCH]", err);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; materialId: string }> }
) {
  const { materialId } = await params;
  try {
    await deleteMaterial(materialId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client-materials DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
