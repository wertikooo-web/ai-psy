import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const execAsync = promisify(exec);

// Whisper API limit is 25 MB — compress anything above this threshold
const COMPRESS_THRESHOLD = 23 * 1024 * 1024; // 23 MB (safe margin)

// 1. Railway accepts the body: Next.js Route Handlers have no built-in body size
//    limit for formData() — only Server Actions respect bodySizeLimit.
//    Node.js HTTP server default is effectively unlimited.
// 2. maxDuration = 300 s covers upload + ffmpeg + Supabase transfer for large files.
// 3. Temp files are always deleted in the finally block below.
// 4. The whole file is buffered once in memory (unavoidable for ffmpeg piping).
//    At 16kbps mono the compressed output is ~7 MB/hour, handling 3+ hour sessions.
export const maxDuration = 300;

async function compressAudio(inputBuffer: Buffer, originalName: string): Promise<Buffer> {
  // Use a unique id so parallel uploads don't collide in /tmp
  const id     = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpIn  = `/tmp/audio_in_${id}`;
  const tmpOut = `/tmp/audio_out_${id}.mp3`;
  try {
    await writeFile(tmpIn, inputBuffer);

    // 16 kbps mono @ 16 kHz ≈ 7.2 MB/hour — handles 3+ hour sessions under 23 MB
    // If still over limit, retry at 8 kbps (≈ 3.6 MB/hour, handles 6+ hours)
    await execAsync(
      `ffmpeg -i "${tmpIn}" -vn -ar 16000 -ac 1 -b:a 16k "${tmpOut}" -y`,
      { timeout: 120_000 },
    );

    let compressed = await readFile(tmpOut);

    if (compressed.length > COMPRESS_THRESHOLD) {
      // Very long recording — compress harder at 8 kbps
      await execAsync(
        `ffmpeg -i "${tmpIn}" -vn -ar 8000 -ac 1 -b:a 8k "${tmpOut}" -y`,
        { timeout: 120_000 },
      );
      compressed = await readFile(tmpOut);
    }

    console.log(
      `[upload] ${originalName}: ${(inputBuffer.length / 1024 / 1024).toFixed(1)} MB` +
      ` → ${(compressed.length / 1024 / 1024).toFixed(1)} MB`,
    );
    return compressed;
  } finally {
    // Always remove both temp files regardless of success or failure
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

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

    // 500 MB hard cap — compression brings this well under all service limits
    const MAX_RAW = 500 * 1024 * 1024;
    if (file.size > MAX_RAW) {
      return NextResponse.json(
        { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(0)} МБ). Максимум — 500 МБ.` },
        { status: 413 },
      );
    }

    // Buffer the file once — this is the only copy held in memory
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let storedExt  = file.name.match(/\.[^.]+$/)?.[0] ?? ".mp3";
    let contentType = file.type || "audio/mpeg";

    if (buffer.length > COMPRESS_THRESHOLD) {
      buffer      = await compressAudio(buffer, file.name);
      storedExt   = ".mp3";
      contentType = "audio/mpeg";
    }

    const safeName   = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._\-а-яА-Я]/g, "_");
    const storedName = `${Date.now()}-${safeName}${storedExt}`;

    if (isSupabaseConfigured()) {
      // storagePath = filename only (no subfolder) so storage://audio/{storedName}
      // correctly maps to bucket "audio", path "{storedName}" when downloading
      const { error } = await supabaseServer!.storage
        .from("audio")
        .upload(storedName, buffer, { contentType, upsert: false });

      if (error) throw new Error(`Storage upload: ${error.message}`);

      return NextResponse.json({
        fileName:   file.name,
        fileUrl:    `storage://audio/${storedName}`,
        fileSize:   buffer.length,
        uploadedAt: new Date().toISOString(),
      });
    }

    // Fallback: local filesystem (Railway ephemeral — works for dev/testing only)
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, storedName), buffer);

    return NextResponse.json({
      fileName:   file.name,
      fileUrl:    `/uploads/${storedName}`,
      fileSize:   buffer.length,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] error:", msg);
    return NextResponse.json({ error: `Ошибка загрузки: ${msg}` }, { status: 500 });
  }
}
