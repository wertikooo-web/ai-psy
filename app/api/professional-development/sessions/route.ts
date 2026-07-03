import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp           = req.nextUrl.searchParams;
  const sessionType  = sp.get("session_type");
  const format       = sp.get("format");
  const groupMode    = sp.get("group_or_individual");
  const supervisor   = sp.get("supervisor_name");
  const from         = sp.get("from");
  const to           = sp.get("to");

  let query = supabaseServer!
    .from("professional_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false });

  if (sessionType) query = query.eq("session_type", sessionType);
  if (format)      query = query.eq("format", format);
  if (groupMode)   query = query.eq("group_or_individual", groupMode);
  if (supervisor)  query = query.ilike("supervisor_name", `%${supervisor}%`);
  if (from)        query = query.gte("session_date", from);
  if (to)          query = query.lte("session_date", to);

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

  if (!body.session_type) return NextResponse.json({ error: "Тип встречи обязателен" }, { status: 400 });
  if (!body.session_date) return NextResponse.json({ error: "Дата обязательна" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_sessions")
    .insert({
      user_id:                    userId,
      session_type:               body.session_type,
      session_date:               body.session_date,
      duration_minutes:           body.duration_minutes           ?? null,
      supervisor_name:            body.supervisor_name            || null,
      organization:               body.organization               || null,
      format:                     body.format                     || "online",
      group_or_individual:        body.group_or_individual        || "individual",
      cost:                       body.cost                       ?? null,
      currency:                   body.currency                   || "RUB",
      topic:                      body.topic                      || null,
      request_summary:            body.request_summary            || null,
      main_insights:              body.main_insights              || null,
      supervisor_recommendations: body.supervisor_recommendations || null,
      next_steps:                 body.next_steps                 || null,
      next_session_date:          body.next_session_date          || null,
      related_client_id:          body.related_client_id          || null,
      confidentiality_mode:       body.confidentiality_mode       || "anonymous",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
