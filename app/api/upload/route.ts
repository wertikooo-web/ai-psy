import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

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

      // Return storage path — transcribe route will download it back via service role
      return NextResponse.json({
        fileName:   file.name,
        fileUrl:    `storage://audio/${storedName}`,
        fileSize:   file.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    // Fallback: local filesystem
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
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } };
