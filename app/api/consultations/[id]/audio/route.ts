import { NextRequest, NextResponse } from "next/server";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";
import { deleteFromStorage, isStorageUrl } from "@/lib/supabase/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const consultation = await getConsultation(id);
  if (!consultation) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const fileUrl = consultation.audio?.fileUrl ?? (consultation as unknown as Record<string, unknown>).fileUrl as string | undefined;
  if (!fileUrl) {
    return NextResponse.json({ error: "Нет аудиофайла" }, { status: 404 });
  }

  if (isStorageUrl(fileUrl)) {
    const match = fileUrl.match(/^storage:\/\/([^/]+)\/(.+)$/);
    if (!match) return NextResponse.json({ error: "Неверный URL" }, { status: 400 });
    const [, bucket, storagePath] = match;

    const { data, error } = await supabaseServer!.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600); // 1-hour signed URL

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: `Storage: ${error?.message}` }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  }

  // Local file fallback
  return NextResponse.redirect(new URL(fileUrl, _req.url));
}

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
