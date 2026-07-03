import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const status = req.nextUrl.searchParams.get("status");

  let q = supabaseServer!
    .from("professional_reading")
    .select("*")
    .eq("user_id", userId)
    .order("status")
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_reading")
    .insert({
      user_id:        userId,
      title:          body.title.trim(),
      author:         body.author?.trim() || null,
      reading_type:   body.reading_type ?? "book",
      status:         body.status ?? "want_to_read",
      started_date:   body.started_date || null,
      completed_date: body.completed_date || null,
      rating:         body.rating ? Number(body.rating) : null,
      notes:          body.notes?.trim() || null,
      url:            body.url?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
