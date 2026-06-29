import { NextRequest, NextResponse } from "next/server";
import {
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/data/calendarEvents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const event  = await getCalendarEvent(id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body  = await req.json();
    const event = await updateCalendarEvent(id, {
      ...(body.clientId       !== undefined && { clientId:       body.clientId       }),
      ...(body.clientName     !== undefined && { clientName:     body.clientName     }),
      ...(body.consultationId !== undefined && { consultationId: body.consultationId }),
      ...(body.title          !== undefined && { title:          body.title          }),
      ...(body.startsAt       !== undefined && { startsAt:       body.startsAt       }),
      ...(body.endsAt         !== undefined && { endsAt:         body.endsAt         }),
      ...(body.status         !== undefined && { status:         body.status         }),
      ...(body.format         !== undefined && { format:         body.format         }),
      ...(body.location       !== undefined && { location:       body.location       }),
      ...(body.notes          !== undefined && { notes:          body.notes          }),
    });
    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    await deleteCalendarEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
