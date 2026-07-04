import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

const CAL_LABELS: Record<string, string> = {
  supervision: "Супервизия", learning: "Обучение",
  consultation: "Консультация", personal_development: "Личное развитие",
  administrative: "Административное", other: "Другое",
};

const SUP_TYPES = new Set(["supervision", "balint_group", "intervision"]);

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;
  const now  = new Date().toISOString();

  const [coursesRes, sessionsRes, reqsRes, calRes, goalsRes, docsRes] = await Promise.all([
    supabaseServer!.from("professional_courses")
      .select("category, total_hours, completed_hours, status, start_date, end_date")
      .eq("user_id", userId)
      .or(`start_date.lte.${to},end_date.gte.${from},and(start_date.is.null,end_date.is.null)`),

    supabaseServer!.from("professional_sessions")
      .select("session_type, session_date, duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`)
      .lte("session_date", `${to}T23:59:59Z`),

    supabaseServer!.from("accreditation_requirements")
      .select("learning_hours_required, supervision_hours_required")
      .eq("user_id", userId)
      .eq("year", year),

    supabaseServer!.from("calendar_events")
      .select("title, starts_at, event_category")
      .eq("user_id", userId)
      .neq("event_category", "client_session")
      .is("deleted_at", null)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(5),

    supabaseServer!.from("professional_goals")
      .select("title, target_date")
      .eq("user_id", userId)
      .in("status", ["planned", "in_progress"])
      .not("target_date", "is", null)
      .gte("target_date", now.slice(0, 10))
      .order("target_date", { ascending: true })
      .limit(3),

    supabaseServer!.from("professional_documents")
      .select("title, expires_at")
      .eq("user_id", userId)
      .not("expires_at", "is", null)
      .gte("expires_at", now.slice(0, 10))
      .order("expires_at", { ascending: true })
      .limit(3),
  ]);

  const courses  = coursesRes.data  ?? [];
  const sessions = sessionsRes.data ?? [];
  const reqs     = reqsRes.data     ?? [];

  // Actual hours for the year (completed = total_hours; in_progress = completed_hours)
  const learning_hours = courses.reduce((s, c) => {
    if (c.status === "completed")   return s + (c.total_hours ?? c.completed_hours ?? 0);
    if (c.status === "in_progress") return s + (c.completed_hours ?? 0);
    return s;
  }, 0);

  const supervision_hours = sessions
    .filter(s => SUP_TYPES.has(s.session_type))
    .reduce((s, sess) => s + (sess.duration_minutes ?? 0) / 60, 0);

  // Monthly activity (index 0 = January)
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, learning: 0, supervision: 0 }));
  for (const c of courses) {
    const h = c.status === "completed" ? (c.total_hours ?? 0) : (c.completed_hours ?? 0);
    if (h <= 0) continue;
    const ds = c.end_date ?? c.start_date;
    const m = ds ? new Date(ds).getMonth() : new Date().getMonth();
    if (m >= 0 && m < 12) monthly[m].learning = Math.round((monthly[m].learning + h) * 10) / 10;
  }
  for (const s of sessions) {
    if (!SUP_TYPES.has(s.session_type)) continue;
    const h = (s.duration_minutes ?? 0) / 60;
    const m = new Date(s.session_date).getMonth();
    if (m >= 0 && m < 12) monthly[m].supervision = Math.round((monthly[m].supervision + h) * 10) / 10;
  }

  // Format/category breakdown
  const topicMap: Record<string, number> = {};
  for (const c of courses) {
    const h = c.status === "completed" ? (c.total_hours ?? 0) : (c.completed_hours ?? 0);
    if (h > 0 && c.category) topicMap[c.category] = (topicMap[c.category] ?? 0) + h;
  }
  const totalH = Object.values(topicMap).reduce((a, b) => a + b, 0);
  const topics = Object.entries(topicMap)
    .sort(([, a], [, b]) => b - a).slice(0, 6)
    .map(([category, hours]) => ({
      category,
      hours: Math.round(hours * 10) / 10,
      percent: totalH > 0 ? Math.round((hours / totalH) * 100) : 0,
    }));

  // Year targets from accreditation_requirements
  let year_targets: { learning: number; supervision: number } | null = null;
  if (reqs.length > 0) {
    const l  = reqs.reduce((s, r) => s + (r.learning_hours_required    ?? 0), 0);
    const sv = reqs.reduce((s, r) => s + (r.supervision_hours_required ?? 0), 0);
    if (l > 0 || sv > 0) year_targets = { learning: l, supervision: sv };
  }

  // Upcoming events (calendar + goals + expiring docs)
  const events: { type: string; title: string; date: string; subtitle?: string }[] = [];
  for (const e of calRes.data ?? [])
    events.push({ type: "calendar", title: e.title, date: e.starts_at,
      subtitle: CAL_LABELS[e.event_category] ?? e.event_category });
  for (const g of goalsRes.data ?? [])
    events.push({ type: "goal", title: g.title, date: g.target_date, subtitle: "Цель развития" });
  for (const d of docsRes.data ?? [])
    events.push({ type: "document", title: d.title, date: d.expires_at, subtitle: "Истечение документа" });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({
    actual_hours: {
      learning:    Math.round(learning_hours    * 10) / 10,
      supervision: Math.round(supervision_hours * 10) / 10,
    },
    monthly_activity: monthly,
    topics,
    year_targets,
    upcoming_events: events.slice(0, 4),
  });
}
