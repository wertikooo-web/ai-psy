import { NextRequest, NextResponse } from "next/server";
import { deleteItem } from "@/lib/clientHistoryStore";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; itemId: string }> }
) {
  const { itemId } = await params;
  try {
    await deleteItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[client-history DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
