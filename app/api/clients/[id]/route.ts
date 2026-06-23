import { NextRequest, NextResponse } from "next/server";
import { deleteClient } from "@/lib/clientStore";
import { readAll, writeAll } from "@/lib/consultationStore";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteClient(id);

    // Delete all consultations belonging to this client
    const all = await readAll();
    await writeAll(all.filter((c) => c.clientId !== id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clients DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
