import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { updateVoiceNote } from "@/lib/data/voiceNotes";

export async function POST(req: NextRequest) {
  try {
    const { id, audioPath } = await req.json();
    if (!id || !audioPath) return NextResponse.json({ error: "id и audioPath обязательны" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY не задан" }, { status: 500 });

    const filePath = path.join(process.cwd(), "public", audioPath);
    if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Аудиофайл не найден" }, { status: 404 });

    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      file:     fs.createReadStream(filePath),
      model:    "whisper-1",
      language: "ru",
    });

    await updateVoiceNote(id, { text: result.text });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("[voice-notes/transcribe]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ошибка" }, { status: 500 });
  }
}
