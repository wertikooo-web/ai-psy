import { NextRequest, NextResponse } from "next/server";
import { getConsultation, softDeleteConsultation, updateConsultation } from "@/lib/data/consultations";
import { deleteFromStorage, isStorageUrl } from "@/lib/supabase/storage";
import { unlink } from "fs/promises";
import path from "path";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("requestId" in body) updates.requestId = body.requestId ?? null;
    if ("title"     in body) updates.title     = body.title;
    if ("status"    in body) updates.status    = body.status;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
    }
    await updateConsultation(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const consultation = await getConsultation(id);
    if (!consultation) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    return NextResponse.json(consultation);
  } catch (err) {
    console.error("[consultations GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const consultation = await getConsultation(id);

    // Clean up audio file
    const fileUrl = consultation?.audio?.fileUrl ?? consultation?.fileUrl;
    if (fileUrl) {
      if (isStorageUrl(fileUrl)) {
        await deleteFromStorage(fileUrl);
      } else {
        await unlink(path.join(process.cwd(), "public", fileUrl)).catch(() => {});
      }
    }

    await softDeleteConsultation(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[consultations DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
