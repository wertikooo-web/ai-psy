import { NextRequest, NextResponse } from "next/server";
import { addConsultation, getConsultations } from "@/lib/data/consultations";
import type { StoredConsultation } from "@/lib/consultationStore";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const all = await getConsultations();
    return NextResponse.json(all);
  } catch (err) {
    console.error("[consultations GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
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

    if (source === "notes" && body.transcriptText) {
      // Notes go to dedicated field — never overwritten by Whisper
      record.notes = body.transcriptText;
    } else if (source === "transcript" && body.transcriptText) {
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
