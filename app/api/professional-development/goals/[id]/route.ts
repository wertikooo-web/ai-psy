import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;

  const { data, error } = await supabaseServer!
    .from("professional_goals")
    .select("*, professional_goal_courses(course_id, professional_courses(id, title, status, category))")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id: _id, user_id: _uid, created_at: _ca, ...patch } = body as Record<string, unknown>;
  void _id; void _uid; void _ca;

  // Convert empty date strings to null (Postgres rejects "")
  for (const f of ["start_date", "end_date", "started_at", "completed_at", "target_date"] as const)
    if (patch[f] === "") patch[f] = null;

  // Auto-set completed_at when status becomes completed
  if (patch.status === "completed" && !patch.completed_at) {
    patch.completed_at = new Date().toISOString();
    patch.progress     = 100;
  }
  if (patch.status && patch.status !== "completed") {
    patch.completed_at = null;
  }

  const { data, error } = await supabaseServer!
    .from("professional_goals")
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
    .from("professional_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
