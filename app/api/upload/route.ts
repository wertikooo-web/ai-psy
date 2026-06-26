import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const execAsync = promisify(exec);
const SUPABASE_MAX = 49 * 1024 * 1024; // 49 MB (safe under 50 MB free tier)
const WHISPER_MAX  = 24 * 1024 * 1024; // 24 MB (safe under 25 MB Whisper limit)

async function compressAudio(inputBuffer: Buffer, originalName: string): Promise<Buffer> {
  const tmpIn  = `/tmp/upload_in_${Date.now()}`;
  const tmpOut = `/tmp/upload_out_${Date.now()}.mp3`;
  try {
    await writeFile(tmpIn, inputBuffer);
    // Compress to mp3 32kbps mono — ~14 MB/hour, good enough for speech
    await execAsync(`ffmpeg -i "${tmpIn}" -vn -ar 16000 -ac 1 -b:a 32k "${tmpOut}" -y`);
    const compressed = await readFile(tmpOut);
    console.log(`[upload] compressed ${originalName}: ${(inputBuffer.length/1024/1024).toFixed(1)}MB → ${(compressed.length/1024/1024).toFixed(1)}MB`);
    return compressed;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

// Allow up to 500 MB uploads and 5-minute timeout
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    const allowedTypes = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg", "audio/webm"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|ogg|webm)$/i)) {
      return NextResponse.json({ error: "Неподдерживаемый формат файла" }, { status: 400 });
    }

    const MAX_SIZE = 500 * 1024 * 1024; // 500 MB hard cap before compression
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(0)} МБ). Максимум — 500 МБ.` },
        { status: 413 },
      );
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let storedExt = file.name.match(/\.[^.]+$/)?.[0] ?? ".mp3";
    let contentType = file.type || "audio/mpeg";

    // Compress if file exceeds Supabase or Whisper limits
    if (buffer.length > Math.min(SUPABASE_MAX, WHISPER_MAX)) {
      buffer     = await compressAudio(buffer, file.name);
      storedExt  = ".mp3";
      contentType = "audio/mpeg";
    }

    const safeName   = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._\-а-яА-Я]/g, "_");
    const storedName = `${Date.now()}-${safeName}${storedExt}`;

    if (isSupabaseConfigured()) {
      const storagePath = `audio/${storedName}`;
      const { error } = await supabaseServer!.storage
        .from("audio")
        .upload(storagePath, buffer, { contentType, upsert: false });

      if (error) throw new Error(`Storage upload: ${error.message}`);

      return NextResponse.json({
        fileName:   file.name,
        fileUrl:    `storage://audio/${storedName}`,
        fileSize:   file.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    // Fallback: local filesystem (Railway ephemeral — fine for dev/testing)
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, storedName), buffer);

    return NextResponse.json({
      fileName:   file.name,
      fileUrl:    `/uploads/${storedName}`,
      fileSize:   file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] error:", msg);
    return NextResponse.json(
      { error: `Ошибка загрузки: ${msg}` },
      { status: 500 },
    );
  }
}
