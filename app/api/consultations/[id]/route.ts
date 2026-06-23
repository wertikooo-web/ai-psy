import { NextRequest, NextResponse } from "next/server";
import { readAll, writeAll } from "@/lib/consultationStore";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const all = await readAll();
    const target = all.find((c) => c.id === id);

    if (!target) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }

    // Delete audio file if it exists
    if (target.fileUrl) {
      const filePath = path.join(process.cwd(), "public", target.fileUrl);
      await unlink(filePath).catch(() => {});
    }

    await writeAll(all.filter((c) => c.id !== id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[consultations DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
