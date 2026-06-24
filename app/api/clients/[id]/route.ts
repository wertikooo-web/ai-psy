import { NextRequest, NextResponse } from "next/server";
import { updateClientStatus, softDeleteClient } from "@/lib/data/clients";
import { softDeleteConsultationsForClient } from "@/lib/data/consultations";
import { deleteHistoryForClient } from "@/lib/data/clientHistory";
import { deleteMaterialsForClient } from "@/lib/data/clientMaterials";
import type { ClientStatus } from "@/lib/clientStore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { status } = await req.json();
    await updateClientStatus(id, status as ClientStatus);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clients PATCH]", err);
    return NextResponse.json({ error: "Ошибка обновления статуса" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await softDeleteClient(id);
    await softDeleteConsultationsForClient(id);
    await deleteHistoryForClient(id);
    await deleteMaterialsForClient(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clients DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
