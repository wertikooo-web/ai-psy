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

    // Only allow deletion of raw text if formatted version exists
    if (!c.transcriptFormatted?.length) {
      return NextResponse.json(
        { error: "Нельзя удалить исходный текст: форматированная версия ещё не создана" },
        { status: 400 }
      );
    }

    await updateConsultation(id, {
      transcript: {
        text:      "",
        origin:    c.transcript?.origin ?? "whisper",
        createdAt: c.transcript?.createdAt ?? new Date().toISOString(),
      },
      transcriptSegments:      undefined,
      transcriptRawDeletedAt:  new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[transcript-raw DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
