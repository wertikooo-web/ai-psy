import { NextRequest, NextResponse } from "next/server";
import { getCalendarEvents, createCalendarEvent } from "@/lib/data/calendarEvents";

export async function GET(req: NextRequest) {
  const sp   = req.nextUrl.searchParams;
  const from = sp.get("from") ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to   = sp.get("to")   ?? new Date(Date.now() + 90 * 86_400_000).toISOString();
  try {
    const events = await getCalendarEvents(from, to);
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const event = await createCalendarEvent({
      clientId:   body.clientId   || undefined,
      clientName: body.clientName ?? "",
      title:      body.title      ?? "Консультация",
      startsAt:   body.startsAt,
      endsAt:     body.endsAt,
      timezone:   body.timezone   ?? "Europe/Chisinau",
      format:     body.format     ?? "online",
      location:   body.location   || undefined,
      notes:      body.notes      || undefined,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
