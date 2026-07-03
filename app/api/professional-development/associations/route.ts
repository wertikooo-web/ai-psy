import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { data, error } = await supabaseServer!
    .from("professional_associations")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_associations")
    .insert({
      user_id:           userId,
      name:              body.name.trim(),
      acronym:           body.acronym?.trim() || null,
      website:           body.website?.trim() || null,
      member_since:      body.member_since || null,
      membership_expires: body.membership_expires || null,
      fee_amount:        body.fee_amount ?? null,
      fee_currency:      body.fee_currency ?? "EUR",
      fee_period:        body.fee_period ?? "annual",
      status:            body.status ?? "active",
      notes:             body.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
