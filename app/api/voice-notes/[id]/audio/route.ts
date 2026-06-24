import { NextRequest, NextResponse } from "next/server";
import { getVoiceNotes, updateVoiceNote } from "@/lib/data/voiceNotes";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { isStorageUrl, deleteFromStorage } from "@/lib/supabase/storage";
import { unlink } from "fs/promises";
import path from "path";

// GET — resolve audioPath to a browser-playable URL (signed URL or local redirect)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const notes = await getVoiceNotes();
    const note  = notes.find((n) => n.id === id);

    if (!note?.audioPath || note.audioDeleted) {
      return NextResponse.json({ error: "Аудиофайл не найден или удалён" }, { status: 404 });
    }

    if (isStorageUrl(note.audioPath)) {
      // Supabase: generate 1-hour signed URL and redirect
      const storagePath = note.audioPath.replace(/^storage:\/\/[^/]+\//, "");
      const bucket      = note.audioPath.match(/^storage:\/\/([^/]+)\//)?.[1] ?? "voice-notes";
      const { data, error } = await supabaseServer!.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: "Не удалось получить URL аудио" }, { status: 500 });
      }
      return NextResponse.redirect(data.signedUrl);
    } else {
      // Local: redirect to public path
      const origin = req.nextUrl.origin;
      return NextResponse.redirect(`${origin}${note.audioPath}`);
    }
  } catch (err) {
    console.error("[voice-notes/audio GET]", err);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}

// DELETE — remove only the audio file; keep the note and its transcript
// TODO: перенести voice note audio в Supabase Storage для надёжного хранения на Railway
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const notes = await getVoiceNotes();
    const note  = notes.find((n) => n.id === id);
    if (!note) return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });

    if (note.audioPath && !note.audioDeleted) {
      if (isStorageUrl(note.audioPath)) {
        await deleteFromStorage(note.audioPath);
      } else {
        await unlink(path.join(process.cwd(), "public", note.audioPath)).catch(() => {});
      }
    }

    await updateVoiceNote(id, { audioPath: undefined, audioDeleted: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-notes/audio DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления аудио" }, { status: 500 });
  }
}
