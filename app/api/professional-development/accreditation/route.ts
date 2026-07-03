import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const [associations, requirements, sessions, therapy, courses] = await Promise.all([
    supabaseServer!.from("professional_associations").select("*").eq("user_id", userId).order("name"),
    supabaseServer!.from("accreditation_requirements").select("*").eq("user_id", userId).eq("year", year),
    supabaseServer!.from("professional_sessions").select("session_type, duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`)
      .lte("session_date", `${to}T23:59:59Z`),
    supabaseServer!.from("professional_personal_therapy").select("duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`)
      .lte("session_date", `${to}T23:59:59Z`),
    supabaseServer!.from("professional_courses").select("category, total_hours, completed_hours, status")
      .eq("user_id", userId)
      .or(`start_date.gte.${from},end_date.lte.${to}`),
  ]);

  const conf = new Set(["conference", "seminar", "webinar", "masterclass"]);

  const actual = {
    supervision: round(filterSum(sessions.data, s => ["supervision","balint_group"].includes(s.session_type), s => (s.duration_minutes ?? 0) / 60)),
    intervision: round(filterSum(sessions.data, s => s.session_type === "intervision", s => (s.duration_minutes ?? 0) / 60)),
    therapy:     round((therapy.data ?? []).reduce((s, t) => s + (t.duration_minutes ?? 0) / 60, 0)),
    learning:    round(filterSum(courses.data, c => !conf.has(c.category), c => c.status === "completed" ? (c.total_hours ?? 0) : (c.completed_hours ?? 0))),
    conference:  round(filterSum(courses.data, c => conf.has(c.category),  c => c.status === "completed" ? (c.total_hours ?? 0) : (c.completed_hours ?? 0))),
  };

  const reqMap = new Map((requirements.data ?? []).map(r => [r.association_id, r]));

  const assocs = (associations.data ?? []).map(a => ({
    ...a,
    requirements: reqMap.get(a.id) ?? null,
    actual,
  }));

  return NextResponse.json({ year, actual, associations: assocs });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const body = await req.json();
  if (!body.association_id) return NextResponse.json({ error: "association_id required" }, { status: 400 });
  if (!body.year) return NextResponse.json({ error: "year required" }, { status: 400 });

  const { data, error } = await supabaseServer!
    .from("accreditation_requirements")
    .upsert({
      user_id:                    userId,
      association_id:             body.association_id,
      year:                       Number(body.year),
      supervision_hours_required: Number(body.supervision_hours_required ?? 0),
      learning_hours_required:    Number(body.learning_hours_required    ?? 0),
      therapy_hours_required:     Number(body.therapy_hours_required     ?? 0),
      conference_hours_required:  Number(body.conference_hours_required  ?? 0),
      deadline:                   body.deadline || null,
      notes:                      body.notes?.trim() || null,
    }, { onConflict: "user_id,association_id,year" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

function filterSum<T>(arr: T[] | null | undefined, filter: (x: T) => boolean, value: (x: T) => number) {
  return (arr ?? []).filter(filter).reduce((s, x) => s + value(x), 0);
}
function round(n: number) { return Math.round(n * 10) / 10; }
