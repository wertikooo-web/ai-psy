import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

  const { data, error } = await supabaseServer!
    .from("professional_reflections")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const body = await req.json();
  const year = Number(body.year ?? new Date().getFullYear());

  const { data, error } = await supabaseServer!
    .from("professional_reflections")
    .upsert({
      user_id:         userId,
      year,
      key_learnings:   body.key_learnings?.trim()  || null,
      main_direction:  body.main_direction?.trim() || null,
      challenges:      body.challenges?.trim()     || null,
      proud_of:        body.proud_of?.trim()       || null,
      next_year_focus: body.next_year_focus?.trim()|| null,
    }, { onConflict: "user_id,year" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
