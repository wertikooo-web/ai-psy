import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp       = req.nextUrl.searchParams;
  const status   = sp.get("status");
  const category = sp.get("category");
  const format   = sp.get("format");

  let query = supabaseServer!
    .from("professional_courses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status)   query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  if (format)   query = query.eq("format", format);

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
  if (!title) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  if (title.length > 300) return NextResponse.json({ error: "Название слишком длинное" }, { status: 400 });

  if (body.total_hours !== undefined && Number(body.total_hours) < 0)
    return NextResponse.json({ error: "Часы не могут быть отрицательными" }, { status: 400 });
  if (body.completed_hours !== undefined && body.total_hours !== undefined
      && Number(body.completed_hours) > Number(body.total_hours))
    return NextResponse.json({ error: "Пройденные часы не могут превышать общее количество" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_courses")
    .insert({
      user_id:              userId,
      title,
      provider:             body.provider             || null,
      teacher:              body.teacher              || null,
      category:             body.category             || "other",
      format:               body.format               || "online",
      status:               body.status               || "planned",
      start_date:           body.start_date            || null,
      end_date:             body.end_date              || null,
      total_hours:          body.total_hours           ?? null,
      completed_hours:      body.completed_hours       ?? null,
      cost:                 body.cost                  ?? null,
      currency:             body.currency              || "RUB",
      url:                  body.url                   || null,
      description:          body.description           || null,
      skills:               body.skills                || null,
      notes:                body.notes                 || null,
      certificate_received: body.certificate_received  ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
