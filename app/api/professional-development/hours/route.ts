import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp   = req.nextUrl.searchParams;
  const year = sp.get("year") ?? new Date().getFullYear().toString();
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const [courses, sessions, therapy] = await Promise.all([
    supabaseServer!
      .from("professional_courses")
      .select("category, total_hours, completed_hours, status")
      .eq("user_id", userId)
      .or(`start_date.gte.${from},end_date.lte.${to}`),

    supabaseServer!
      .from("professional_sessions")
      .select("session_type, duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`)
      .lte("session_date", `${to}T23:59:59Z`),

    supabaseServer!
      .from("professional_personal_therapy")
      .select("duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`)
      .lte("session_date", `${to}T23:59:59Z`),
  ]);

  // Sum course hours by category
  const courseHours: Record<string, number> = {};
  for (const c of courses.data ?? []) {
    const h = c.status === "completed"
      ? (c.total_hours ?? 0)
      : (c.completed_hours ?? 0);
    courseHours[c.category] = (courseHours[c.category] ?? 0) + h;
  }

  // Sum session hours by type (convert minutes → hours)
  const sessionHours: Record<string, number> = {};
  for (const s of sessions.data ?? []) {
    const h = (s.duration_minutes ?? 0) / 60;
    sessionHours[s.session_type] = (sessionHours[s.session_type] ?? 0) + h;
  }

  const therapyHours = (therapy.data ?? []).reduce(
    (sum, t) => sum + (t.duration_minutes ?? 0) / 60,
    0,
  );

  const totalLearning   = Object.values(courseHours).reduce((a, b) => a + b, 0);
  const totalSupervision = (sessionHours["supervision"] ?? 0)
                         + (sessionHours["balint_group"] ?? 0);
  const totalIntervision = sessionHours["intervision"] ?? 0;
  const totalConference  = (courseHours["conference"] ?? 0)
                         + (courseHours["seminar"] ?? 0)
                         + (courseHours["webinar"] ?? 0);

  return NextResponse.json({
    year:              Number(year),
    total_learning:    Math.round(totalLearning   * 100) / 100,
    total_supervision: Math.round(totalSupervision * 100) / 100,
    total_intervision: Math.round(totalIntervision * 100) / 100,
    total_conference:  Math.round(totalConference  * 100) / 100,
    total_therapy:     Math.round(therapyHours     * 100) / 100,
    total_all:         Math.round((totalLearning + totalSupervision + totalIntervision + totalConference + therapyHours) * 100) / 100,
    by_course_category: courseHours,
    by_session_type:    sessionHours,
  });
}
