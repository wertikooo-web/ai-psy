import { NextRequest, NextResponse } from "next/server";
import { softDeleteConsultation } from "@/lib/data/consultations";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await softDeleteConsultation(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[consultations DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
