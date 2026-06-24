import { NextRequest, NextResponse } from "next/server";
import { deleteVoiceNote, updateVoiceNote, getVoiceNotes } from "@/lib/data/voiceNotes";
import { deleteFromStorage, isStorageUrl } from "@/lib/supabase/storage";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const notes = await getVoiceNotes();
    const note  = notes.find((n) => n.id === id);

    if (note?.audioPath) {
      if (isStorageUrl(note.audioPath)) {
        await deleteFromStorage(note.audioPath);
      } else if (note.audioPath.startsWith("/uploads/")) {
        await unlink(path.join(process.cwd(), "public", note.audioPath)).catch(() => {});
      }
    }

    await deleteVoiceNote(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-notes DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const patch = await req.json();
    await updateVoiceNote(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-notes PATCH]", err);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}
