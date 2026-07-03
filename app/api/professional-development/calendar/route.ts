import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

export interface ProfDevCalendarEvent {
  id:             string;
  title:          string;
  starts_at:      string;
  ends_at?:       string;
  event_category: "course" | "supervision" | "therapy" | "goal";
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp   = req.nextUrl.searchParams;
  const from = sp.get("from") ?? new Date().toISOString().slice(0, 10);
  const to   = sp.get("to")   ?? new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

  const events: ProfDevCalendarEvent[] = [];

  // ── Courses with start_date in range ─────────────────────────────────────────
  const { data: courses } = await supabaseServer!
    .from("professional_courses")
    .select("id, title, start_date, end_date, status")
    .eq("user_id", userId)
    .neq("status", "completed")
    .not("start_date", "is", null)
    .gte("start_date", from)
    .lte("start_date", to)
    .order("start_date", { ascending: true });

  for (const c of courses ?? []) {
    events.push({
      id:             c.id,
      title:          c.title,
      starts_at:      c.start_date,
      ends_at:        c.end_date ?? undefined,
      event_category: "course",
    });
  }

  // ── Supervision / therapy sessions with session_date in range ─────────────────
  const { data: sessions } = await supabaseServer!
    .from("professional_sessions")
    .select("id, session_type, session_date, topic, supervisor_name")
    .eq("user_id", userId)
    .not("session_date", "is", null)
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date", { ascending: true });

  for (const s of sessions ?? []) {
    const isTherapy = s.session_type === "personal_therapy";
    events.push({
      id:             s.id,
      title:          s.topic || s.supervisor_name || (isTherapy ? "Личная терапия" : "Супервизия"),
      starts_at:      s.session_date,
      event_category: isTherapy ? "therapy" : "supervision",
    });
  }

  // ── Goals with target_date in range ──────────────────────────────────────────
  const { data: goals } = await supabaseServer!
    .from("professional_goals")
    .select("id, title, target_date, status")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .not("target_date", "is", null)
    .gte("target_date", from)
    .lte("target_date", to)
    .order("target_date", { ascending: true });

  for (const g of goals ?? []) {
    events.push({
      id:             g.id,
      title:          g.title,
      starts_at:      g.target_date,
      event_category: "goal",
    });
  }

  // Sort by date ascending
  events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return NextResponse.json(events);
}
