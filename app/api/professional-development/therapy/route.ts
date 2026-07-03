import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp   = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to   = sp.get("to");

  let query = supabaseServer!
    .from("professional_personal_therapy")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false });

  if (from) query = query.gte("session_date", from);
  if (to)   query = query.lte("session_date", to);

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

  if (!body.session_date) return NextResponse.json({ error: "Дата обязательна" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_personal_therapy")
    .insert({
      user_id:          userId,
      session_date:     body.session_date,
      duration_minutes: body.duration_minutes ?? null,
      therapist_name:   body.therapist_name   || null,
      format:           body.format           || "offline",
      cost:             body.cost             ?? null,
      currency:         body.currency         || "RUB",
      notes:            body.notes            || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
