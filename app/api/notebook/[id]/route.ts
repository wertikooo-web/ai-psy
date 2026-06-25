import { NextResponse } from "next/server";
import { deleteNotebookEntry } from "@/lib/notebookStore";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteNotebookEntry(id);
  return NextResponse.json({ ok: true });
}
