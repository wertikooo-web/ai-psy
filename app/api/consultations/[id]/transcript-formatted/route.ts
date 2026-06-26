import { NextRequest, NextResponse } from "next/server";
import { getConsultation, updateConsultation } from "@/lib/data/consultations";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const c = await getConsultation(id);
    if (!c) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    await updateConsultation(id, {
      transcriptFormatted:              undefined,
      transcriptFormattedDeletedAt:     new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[transcript-formatted DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
