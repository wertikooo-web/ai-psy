import { NextRequest, NextResponse } from "next/server";
import { deleteMaterial } from "@/lib/data/clientMaterials";

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
