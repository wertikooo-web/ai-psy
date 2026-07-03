import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp   = req.nextUrl.searchParams;
  const year = sp.get("year");

  let q = supabaseServer!
    .from("professional_expenses")
    .select("*, professional_courses(title)")
    .eq("user_id", userId)
    .order("paid_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (year) {
    q = q.gte("paid_date", `${year}-01-01`).lte("paid_date", `${year}-12-31`);
  }

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
  if (body.amount == null || Number(body.amount) < 0) return NextResponse.json({ error: "valid amount required" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("professional_expenses")
    .insert({
      user_id:          userId,
      title:            body.title.trim(),
      expense_type:     body.expense_type ?? "other",
      amount:           Number(body.amount),
      currency:         body.currency ?? "EUR",
      paid_date:        body.paid_date || null,
      is_paid:          body.is_paid ?? false,
      is_tax_deductible: body.is_tax_deductible ?? true,
      notes:            body.notes?.trim() || null,
      course_id:        body.course_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
