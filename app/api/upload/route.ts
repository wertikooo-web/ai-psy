import { NextRequest, NextResponse } from "next/server";
import { AUDIO_MAX_RAW_SIZE, isSupportedAudioFile, storeAudioBuffer } from "@/lib/audio/uploadAudio";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (!isSupportedAudioFile(file.name, file.type)) {
      return NextResponse.json({ error: "Неподдерживаемый формат файла" }, { status: 400 });
    }

    if (file.size > AUDIO_MAX_RAW_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(0)} МБ). Максимум — 500 МБ.` },
        { status: 413 },
      );
    }

    const stored = await storeAudioBuffer({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      mimeType: file.type,
    });

    return NextResponse.json(stored);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] error:", msg);
    return NextResponse.json({ error: `Ошибка загрузки: ${msg}` }, { status: 500 });
  }
}
