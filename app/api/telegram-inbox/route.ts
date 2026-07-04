import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import {
  getTelegramMessages,
  updateTelegramMessage,
  type TelegramMessageStatus,
} from "@/lib/data/telegramMessages";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status") as TelegramMessageStatus | null;

    const { items, total } = await getTelegramMessages(userId, {
      status: filterStatus ?? undefined,
      limit:  100,
    });

    // Enrich with client names
    const clientIds = [...new Set(items.map((m) => m.clientId).filter(Boolean))] as string[];
    let clientMap: Record<string, string> = {};

    if (clientIds.length > 0 && isSupabaseConfigured()) {
      const { data: clients } = await supabaseServer!
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds)
        .is("deleted_at", null);
      if (clients) {
        clientMap = Object.fromEntries(clients.map((c) => [c.id, c.full_name]));
      }
    }

    const result = items.map((m) => ({
      ...m,
      clientName: m.clientId ? (clientMap[m.clientId] ?? null) : null,
    }));

    return NextResponse.json({ items: result, total });
  } catch (err) {
    console.error("[telegram-inbox GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки входящих" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await getAuthenticatedUserId(req);
    const body = await req.json() as { id: string; status?: TelegramMessageStatus; clientId?: string | null };
    const { id, status, clientId } = body;

    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

    const patch: Parameters<typeof updateTelegramMessage>[1] = {};
    if (status)          patch.status   = status;
    if ("clientId" in body) patch.clientId = clientId ?? null;

    await updateTelegramMessage(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-inbox PATCH]", err);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await getAuthenticatedUserId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

    await updateTelegramMessage(id, { status: "archived" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-inbox DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
