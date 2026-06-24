import { NextRequest, NextResponse } from "next/server";

function pad(n: number) { return String(n).padStart(2, "0"); }

function toICSDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + "Z"
  );
}

function parseDurationMinutes(duration?: string): number {
  if (!duration) return 60;
  const match = duration.match(/(\d+)/);
  return match ? Number(match[1]) : 60;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientName  = searchParams.get("clientName")  ?? "Клиент";
  const date        = searchParams.get("date")        ?? new Date().toISOString();
  const duration    = searchParams.get("duration")    ?? "";
  const topic       = searchParams.get("topic")       ?? "";
  const sessionNum  = searchParams.get("session")     ?? "";

  const dtStart   = toICSDate(date);
  const minutes   = parseDurationMinutes(duration);
  const durationStr = `PT${minutes}M`;
  const summary   = `Консультация${sessionNum ? ` #${sessionNum}` : ""} · ${clientName}`;
  const desc      = topic ? `Тема: ${topic}` : "Психологическая консультация";
  const uid       = `transcript-ai-${Date.now()}@psy`;
  const now       = toICSDate(new Date().toISOString());

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Transcript AI PSY//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DURATION:${durationStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const filename = `consultation-${clientName.replace(/\s+/g, "-")}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
