import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, writeFile, mkdir } from "fs/promises";
import path from "path";

const KB_DIR = path.join(process.cwd(), "knowledge_base");

export async function GET() {
  try {
    const entries = await readdir(KB_DIR);
    const files = await Promise.all(
      entries
        .filter((f) => !f.startsWith("."))
        .map(async (name) => {
          const filePath = path.join(KB_DIR, name);
          const s = await stat(filePath);
          return {
            name,
            size:     s.size,
            modifiedAt: s.mtime.toISOString(),
            isDir:    s.isDirectory(),
          };
        })
    );
    return NextResponse.json(files.filter((f) => !f.isDir));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    if (![".md", ".txt"].includes(ext)) {
      return NextResponse.json({ error: "Разрешены только .md и .txt файлы" }, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await mkdir(KB_DIR, { recursive: true });
    await writeFile(path.join(KB_DIR, file.name), buffer);

    return NextResponse.json({ ok: true, name: file.name }, { status: 201 });
  } catch (err) {
    console.error("[knowledge-base POST]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
