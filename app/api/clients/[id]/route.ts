import { NextRequest, NextResponse } from "next/server";
import { deleteClient, updateClientStatus } from "@/lib/clientStore";
import type { ClientStatus } from "@/lib/clientStore";
import { readAll, writeAll } from "@/lib/consultationStore";
import { deleteForClient as deleteHistoryForClient } from "@/lib/clientHistoryStore";
import { deleteForClient as deleteMaterialsForClient } from "@/lib/clientMaterialsStore";

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
    await deleteClient(id);

    // Cascade-delete all related data
    const all = await readAll();
    await writeAll(all.filter((c) => c.clientId !== id));
    await deleteHistoryForClient(id);
    await deleteMaterialsForClient(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clients DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
