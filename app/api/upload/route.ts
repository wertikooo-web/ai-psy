import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

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

    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(0)} МБ). Максимум — 50 МБ.` },
        { status: 413 },
      );
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName   = file.name.replace(/[^a-zA-Z0-9._\-а-яА-Я]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;

    if (isSupabaseConfigured()) {
      const storagePath = `audio/${storedName}`;
      const { error } = await supabaseServer!.storage
        .from("audio")
        .upload(storagePath, buffer, { contentType: file.type || "audio/mpeg", upsert: false });

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
