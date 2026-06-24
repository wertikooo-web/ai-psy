import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { downloadFromStorage, isStorageUrl } from "@/lib/supabase/storage";
import { toFile } from "openai";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-...")) {
    throw new Error("OPENAI_API_KEY не задан или не валиден");
  }
  return new OpenAI({ apiKey });
}

export async function POST(req: NextRequest) {
  let consultationId: string | undefined;
  try {
    const body = await req.json();
    consultationId = body.consultationId;

    if (!consultationId) {
      return NextResponse.json({ error: "consultationId обязателен" }, { status: 400 });
    }

    const consultation = await getConsultation(consultationId);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    const audioFile =
      consultation.audio ??
      (consultation.fileUrl
        ? { fileName: consultation.fileName ?? "", fileUrl: consultation.fileUrl, fileSize: consultation.fileSize ?? 0 }
        : null);

    if (!audioFile?.fileUrl) {
      return NextResponse.json({ error: "Аудиофайл не найден в записи консультации" }, { status: 400 });
    }

    await updateConsultation(consultationId, { status: "transcribing" });

    const openai  = getOpenAI();
    let audioInput: Parameters<typeof openai.audio.transcriptions.create>[0]["file"];

    if (isStorageUrl(audioFile.fileUrl)) {
      // Download from Supabase Storage
      const buffer = await downloadFromStorage(audioFile.fileUrl);
      if (!buffer) {
        await updateConsultation(consultationId, { status: "created" });
        return NextResponse.json({ error: "Не удалось скачать файл из Storage" }, { status: 500 });
      }
      const ext = audioFile.fileName?.split(".").pop() ?? "mp3";
      audioInput = await toFile(buffer, `audio.${ext}`, { type: `audio/${ext}` });
    } else {
      // Local filesystem fallback
      const filePath = path.join(process.cwd(), "public", audioFile.fileUrl);
      if (!fs.existsSync(filePath)) {
        await updateConsultation(consultationId, { status: "created" });
        return NextResponse.json({ error: `Файл не найден: ${audioFile.fileUrl}` }, { status: 404 });
      }
      audioInput = fs.createReadStream(filePath);
    }

    const transcription = await openai.audio.transcriptions.create({
      file:     audioInput,
      model:    "whisper-1",
      language: "ru",
    });

    await updateConsultation(consultationId, {
      status: "ready",
      transcript: {
        text:      transcription.text,
        origin:    "whisper",
        createdAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ text: transcription.text });

  } catch (err) {
    console.error("[transcribe]", err);
    if (consultationId) {
      await updateConsultation(consultationId, { status: "created" }).catch(() => {});
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка транскрипции" },
      { status: 500 },
    );
  }
}
