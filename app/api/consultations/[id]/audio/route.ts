import { NextRequest, NextResponse } from "next/server";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { deleteFromStorage, isStorageUrl } from "@/lib/supabase/storage";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const consultation = await getConsultation(id);
    if (!consultation) {
      return NextResponse.json({ error: "Консультация не найдена" }, { status: 404 });
    }

    const fileUrl = consultation.audio?.fileUrl ?? consultation.fileUrl;
    if (fileUrl) {
      if (isStorageUrl(fileUrl)) {
        await deleteFromStorage(fileUrl);
      } else {
        await unlink(path.join(process.cwd(), "public", fileUrl)).catch(() => {});
      }
    }

    // Clear audio fields, keep transcript
    await updateConsultation(id, { audio: undefined });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[consultations/audio DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления аудио" }, { status: 500 });
  }
}
