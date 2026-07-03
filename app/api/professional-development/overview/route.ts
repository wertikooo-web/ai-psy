import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const year  = new Date().getFullYear().toString();
  const from  = `${year}-01-01`;
  const to    = `${year}-12-31`;
  const now   = new Date().toISOString();
  const in60d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const [
    coursesInProgress,
    coursesCompleted,
    certCount,
    recentCourses,
    recentSessions,
    recentDocs,
    activeGoals,
    sessionsThisYear,
    therapyThisYear,
    nextEvent,
    lastSupervision,
    expiringAssociations,
    hoursByCategory,
  ] = await Promise.all([
    supabaseServer!.from("professional_courses").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "in_progress"),

    supabaseServer!.from("professional_courses").select("total_hours, completed_hours")
      .eq("user_id", userId).eq("status", "completed")
      .or(`start_date.gte.${from},end_date.lte.${to}`),

    supabaseServer!.from("professional_courses").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("certificate_received", true),

    supabaseServer!.from("professional_courses")
      .select("id,title,status,category,total_hours,completed_hours,start_date,end_date,certificate_received,provider")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),

    supabaseServer!.from("professional_sessions")
      .select("id,session_type,session_date,duration_minutes,supervisor_name,topic,confidentiality_mode")
      .eq("user_id", userId).order("session_date", { ascending: false }).limit(5),

    supabaseServer!.from("professional_documents")
      .select("id,title,document_type,organization,issued_date")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),

    supabaseServer!.from("professional_goals")
      .select("id,title,status,progress,target_date")
      .eq("user_id", userId).in("status", ["planned","in_progress"])
      .order("created_at", { ascending: false }).limit(5),

    supabaseServer!.from("professional_sessions").select("session_type,duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`).lte("session_date", `${to}T23:59:59Z`),

    supabaseServer!.from("professional_personal_therapy").select("duration_minutes")
      .eq("user_id", userId)
      .gte("session_date", `${from}T00:00:00Z`).lte("session_date", `${to}T23:59:59Z`),

    supabaseServer!.from("calendar_events").select("title,starts_at,event_category")
      .eq("user_id", userId).neq("event_category", "client_session")
      .is("deleted_at", null).gte("starts_at", now)
      .order("starts_at", { ascending: true }).limit(1),

    // Last supervision date for reminders
    supabaseServer!.from("professional_sessions").select("session_date")
      .eq("user_id", userId)
      .in("session_type", ["supervision","balint_group","intervision"])
      .order("session_date", { ascending: false }).limit(1),

    // Associations expiring within 60 days
    supabaseServer!.from("professional_associations")
      .select("id,name,acronym,membership_expires")
      .eq("user_id", userId).eq("status", "active")
      .gte("membership_expires", now.slice(0, 10))
      .lte("membership_expires", in60d),

    // Hours by course category for breakdown widget
    supabaseServer!.from("professional_courses")
      .select("category,total_hours,completed_hours,status")
      .eq("user_id", userId)
      .or(`start_date.gte.${from},end_date.lte.${to}`),
  ]);

  const learningHours = (coursesCompleted.data ?? [])
    .reduce((sum, c) => sum + (c.total_hours ?? c.completed_hours ?? 0), 0);

  const supervisionHours = (sessionsThisYear.data ?? [])
    .filter(s => ["supervision","balint_group"].includes(s.session_type))
    .reduce((sum, s) => sum + (s.duration_minutes ?? 0) / 60, 0);

  const therapyHours = (therapyThisYear.data ?? [])
    .reduce((sum, t) => sum + (t.duration_minutes ?? 0) / 60, 0);

  // Hours breakdown by category
  const catHours: Record<string, number> = {};
  for (const c of hoursByCategory.data ?? []) {
    const h = c.status === "completed" ? (c.total_hours ?? 0) : (c.completed_hours ?? 0);
    catHours[c.category] = (catHours[c.category] ?? 0) + h;
  }

  return NextResponse.json({
    learning_hours_this_year:    Math.round(learningHours    * 10) / 10,
    supervision_hours_this_year: Math.round(supervisionHours * 10) / 10,
    therapy_hours_this_year:     Math.round(therapyHours     * 10) / 10,
    courses_in_progress:         coursesInProgress.count  ?? 0,
    certificates_total:          certCount.count          ?? 0,
    next_event:                  nextEvent.data?.[0]      ?? null,
    recent_courses:              recentCourses.data       ?? [],
    recent_sessions:             recentSessions.data      ?? [],
    recent_documents:            recentDocs.data          ?? [],
    active_goals:                activeGoals.data         ?? [],
    last_supervision_date:       lastSupervision.data?.[0]?.session_date ?? null,
    expiring_associations:       expiringAssociations.data ?? [],
    hours_by_category:           catHours,
  });
}
