import { NextResponse } from "next/server";
import { deleteEntry } from "@/lib/data/notebook";

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
