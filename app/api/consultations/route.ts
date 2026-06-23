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

    const source = body.source ?? "audio";
    const now    = new Date().toISOString();

    const record: StoredConsultation = {
      id:             randomUUID(),
      clientId:       body.clientId       ?? "",
      clientName:     body.clientName     ?? "Клиент",
      clientInitials: body.clientInitials ?? "КЛ",
      clientColor:    body.clientColor    ?? "#6088ff",
      title:          body.title          || "Без названия",
      createdAt:      body.createdAt      ?? now,
      source,
      status:         source === "audio" ? "created" : "ready",
    };

    if (source === "audio" && body.audio) {
      record.audio = {
        fileName: body.audio.fileName,
        fileUrl:  body.audio.fileUrl,
        fileSize: body.audio.fileSize,
      };
    }

    if ((source === "transcript" || source === "notes") && body.transcriptText) {
      record.transcript = {
        text:      body.transcriptText,
        origin:    body.transcriptFileName ? "file" : "manual",
        fileName:  body.transcriptFileName,
        createdAt: now,
      };
    }

    await addConsultation(record);
    return NextResponse.json({ id: record.id }, { status: 201 });
  } catch (err) {
    console.error("Consultation create error:", err);
    return NextResponse.json({ error: "Ошибка создания записи" }, { status: 500 });
  }
}
