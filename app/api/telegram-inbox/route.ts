import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";

const EXCLUDED_STATUSES = ["completed", "cancelled"];

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const userId = await getAuthenticatedUserId(req);
    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status"); // optional filter

    let query = supabaseServer!
      .from("telegram_audio_uploads")
      .select("*", { count: "exact" })
      .eq("profile_id", userId)
      .not("status", "in", `(${EXCLUDED_STATUSES.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterStatus && !EXCLUDED_STATUSES.includes(filterStatus)) {
      query = query.eq("status", filterStatus);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const items = data ?? [];

    // Fetch client names for items that have client_id
    const clientIds = [...new Set(items.map((r) => r.client_id).filter(Boolean))] as string[];
    let clientMap: Record<string, string> = {};

    if (clientIds.length > 0) {
      const { data: clients } = await supabaseServer!
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds)
        .is("deleted_at", null);

      if (clients) {
        clientMap = Object.fromEntries(clients.map((c) => [c.id, c.full_name]));
      }
    }

    const result = items.map((row) => ({
      id: row.id as string,
      status: row.status as string,
      mimeType: (row.mime_type as string | null) ?? null,
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      fileSize: row.file_size == null ? null : Number(row.file_size),
      originalFilename: (row.original_filename as string | null) ?? null,
      clientId: (row.client_id as string | null) ?? null,
      clientName: row.client_id ? (clientMap[row.client_id as string] ?? null) : null,
      consultationId: (row.consultation_id as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      createdAt: row.created_at as string,
    }));

    return NextResponse.json({ items: result, total: count ?? result.length });
  } catch (err) {
    console.error("[telegram-inbox GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки входящих" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const userId = await getAuthenticatedUserId(req);
    const body = await req.json();
    const { id, clientId, status } = body as { id: string; clientId?: string | null; status?: string };

    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if ("clientId" in body) patch.client_id = clientId ?? null;
    if (status) patch.status = status;
    if (status === "completed") patch.completed_at = new Date().toISOString();

    const { data, error } = await supabaseServer!
      .from("telegram_audio_uploads")
      .update(patch)
      .eq("id", id)
      .eq("profile_id", userId)
      .select("id, status, client_id")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[telegram-inbox PATCH]", err);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const userId = await getAuthenticatedUserId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });

    const { error } = await supabaseServer!
      .from("telegram_audio_uploads")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("profile_id", userId);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-inbox DELETE]", err);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
