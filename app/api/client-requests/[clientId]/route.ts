import { NextRequest, NextResponse } from "next/server";
import {
  getClientRequests,
  createClientRequest,
  updateClientRequestText,
} from "@/lib/data/clientRequests";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params;
  try {
    const requests = await getClientRequests(clientId);
    return NextResponse.json(requests);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — create new request (makeCurrent=true)
export async function POST(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const text: string = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Текст запроса обязателен" }, { status: 400 });

    const request = await createClientRequest({
      clientId,
      text,
      source:      "new_request",
      comment:     body.comment?.trim() || undefined,
      makeCurrent: true,
    });
    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — update text of existing request (Уточнить формулировку)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { clientId } = await params;
  try {
    const body = await req.json();
    const text: string = (body.text ?? "").trim();
    if (!text)            return NextResponse.json({ error: "Текст запроса обязателен" }, { status: 400 });
    if (!body.requestId)  return NextResponse.json({ error: "requestId обязателен" },    { status: 400 });

    const updated = await updateClientRequestText(body.requestId, text, clientId);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
