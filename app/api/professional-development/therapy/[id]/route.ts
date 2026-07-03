import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id: _id, user_id: _uid, created_at: _ca, ...patch } = body as Record<string, unknown>;
  void _id; void _uid; void _ca;

  const { data, error } = await supabaseServer!
    .from("professional_personal_therapy")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Не найдено" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;

  const { error } = await supabaseServer!
    .from("professional_personal_therapy")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
