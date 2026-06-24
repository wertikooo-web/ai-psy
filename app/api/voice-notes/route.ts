import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getVoiceNotes, saveVoiceNote } from "@/lib/data/voiceNotes";

export async function GET() {
  try {
    const notes = await getVoiceNotes();
    return NextResponse.json(notes);
  } catch (err) {
    console.error("[voice-notes GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio       = form.get("audio")       as File | null;
    const id          = form.get("id")          as string;
    const durationSec = Number(form.get("durationSec") ?? 0);
    const clientId    = (form.get("clientId")    as string) || undefined;
    const clientName  = (form.get("clientName")  as string) || undefined;
    const consultationId    = (form.get("consultationId")    as string) || undefined;
    const consultationTitle = (form.get("consultationTitle") as string) || undefined;
    const textContent = (form.get("text") as string) || undefined;

    let audioPath: string | undefined;

    if (audio && audio.size > 0) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const filename = `voice-${id}.webm`;
      const buffer   = Buffer.from(await audio.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);
      audioPath = `/uploads/${filename}`;
    }

    await saveVoiceNote({
      id,
      createdAt: new Date().toISOString(),
      durationSec,
      audioPath,
      text: textContent,
      clientId,
      clientName,
      consultationId,
      consultationTitle,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-notes POST]", err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
