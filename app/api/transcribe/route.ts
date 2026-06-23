import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { getConsultation, updateConsultation } from "@/lib/consultationStore";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-...")) {
    throw new Error("OPENAI_API_KEY не задан или не валиден");
  }
  return new OpenAI({ apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const { consultationId } = await req.json();

    if (!consultationId) {
      return NextResponse.json({ error: "consultationId обязателен" }, { status: 400 });
    }

    const consultation = await getConsultation(consultationId);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    // Resolve audio file
    const audioFile =
      consultation.audio ??
      (consultation.fileUrl
        ? { fileName: consultation.fileName ?? "", fileUrl: consultation.fileUrl, fileSize: consultation.fileSize ?? 0 }
        : null);

    if (!audioFile?.fileUrl) {
      return NextResponse.json({ error: "Аудиофайл не найден в записи консультации" }, { status: 400 });
    }

    // Resolve absolute path: fileUrl is "/uploads/filename.mp3"
    const filePath = path.join(process.cwd(), "public", audioFile.fileUrl);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Файл не найден на диске: ${audioFile.fileUrl}` },
        { status: 404 },
      );
    }

    // Mark as transcribing
    await updateConsultation(consultationId, { status: "transcribing" });

    // Call Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ru",
    });

    const text = transcription.text;

    // Save transcript and update status
    await updateConsultation(consultationId, {
      status: "ready",
      transcript: {
        text,
        origin: "whisper",
        createdAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ text });

  } catch (err) {
    console.error("[transcribe]", err);

    // If we errored mid-way, reset status to "created"
    try {
      const { consultationId } = await new Response(req.body).json().catch(() => ({}));
      if (consultationId) await updateConsultation(consultationId, { status: "created" });
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка транскрипции" },
      { status: 500 },
    );
  }
}
