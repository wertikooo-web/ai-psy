import { NextRequest, NextResponse } from "next/server";
import { deleteVoiceNote, updateVoiceNote } from "@/lib/voiceNoteStore";
import { unlink } from "fs/promises";
import path from "path";
import { readVoiceNotes } from "@/lib/voiceNoteStore";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await readVoiceNotes();
  const note  = notes.find((n) => n.id === id);
  if (note?.audioPath) {
    try {
      await unlink(path.join(process.cwd(), "public", note.audioPath));
    } catch { /* file may not exist */ }
  }
  await deleteVoiceNote(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await req.json();
  await updateVoiceNote(id, patch);
  return NextResponse.json({ ok: true });
}
