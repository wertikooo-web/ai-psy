import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp     = req.nextUrl.searchParams;
  const status = sp.get("status");

  let query = supabaseServer!
    .from("professional_goals")
    .select("*, professional_goal_courses(course_id, professional_courses(id, title, status))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = (body.title as string | undefined)?.trim();
  if (!title) return NextResponse.json({ error: "Название цели обязательно" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_goals")
    .insert({
      user_id:     userId,
      title,
      description: body.description || null,
      motivation:  body.motivation  || null,
      status:      body.status      || "planned",
      target_date: body.target_date || null,
      progress:    body.progress    ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
