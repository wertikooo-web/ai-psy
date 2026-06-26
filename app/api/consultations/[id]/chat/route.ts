import { NextRequest, NextResponse } from "next/server";
import {
  getChatMessages,
  saveChatMessages,
  clearChatMessages,
} from "@/lib/data/chatMessages";

type Context = { params: Promise<{ id: string }> };

// GET /api/consultations/[id]/chat — load history
export async function GET(_req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

  try {
    const rows = await getChatMessages(id);
    const messages = rows.map((r) => ({
      id:        r.id,
      role:      r.role,
      content:   r.content,
      timestamp: new Date(r.created_at).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
    return NextResponse.json({ messages });
  } catch (err) {
    console.error(`[api/chat/GET] consultationId=${id}`, err instanceof Error ? err.message : err);
    return NextResponse.json({ messages: [] });
  }
}

// POST /api/consultations/[id]/chat — save messages batch
// Body: { messages: [{ role: "user"|"assistant", content: string }] }
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

  try {
    const body = await req.json();
    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      body?.messages ?? [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const valid = messages.filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    );

    await saveChatMessages(id, valid);
    return NextResponse.json({ ok: true, saved: valid.length });
  } catch (err) {
    console.error(`[api/chat/POST] consultationId=${id}`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

// DELETE /api/consultations/[id]/chat — clear all messages
export async function DELETE(_req: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

  try {
    await clearChatMessages(id);
    console.log(`[api/chat/DELETE] consultationId=${id} cleared`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[api/chat/DELETE] consultationId=${id}`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Ошибка очистки" }, { status: 500 });
  }
}
