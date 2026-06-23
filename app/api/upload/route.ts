import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Safe filename: timestamp + sanitised original name
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-а-яА-Я]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;
    const filePath   = path.join(uploadDir, storedName);

    await writeFile(filePath, buffer);

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

// Allow up to 500 MB
export const config = { api: { bodyParser: false } };
