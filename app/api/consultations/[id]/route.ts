import { NextRequest, NextResponse } from "next/server";
import { getConsultation, softDeleteConsultation } from "@/lib/data/consultations";
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
