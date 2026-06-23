import { NextRequest, NextResponse } from "next/server";
import { addConsultation, readAll, StoredConsultation } from "@/lib/consultationStore";
import { randomUUID } from "crypto";

export async function GET() {
  const all = await readAll();
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const record: StoredConsultation = {
      id:             randomUUID(),
      clientId:       body.clientId       ?? "",
      clientName:     body.clientName     ?? "Клиент",
      clientInitials: body.clientInitials ?? "КЛ",
      clientColor:    body.clientColor    ?? "#6088ff",
      title:          body.title          || body.fileName,
      fileName:       body.fileName,
      fileUrl:        body.fileUrl,
      fileSize:       body.fileSize,
      uploadedAt:     body.uploadedAt,
      status:         "uploaded",
    };

    await addConsultation(record);
    return NextResponse.json({ id: record.id }, { status: 201 });
  } catch (err) {
    console.error("Consultation create error:", err);
    return NextResponse.json({ error: "Ошибка создания записи" }, { status: 500 });
  }
}
