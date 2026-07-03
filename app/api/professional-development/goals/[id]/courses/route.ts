import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";

// POST /api/professional-development/goals/[id]/courses
// Body: { course_id: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id: goalId } = await params;
  let body: { course_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.course_id) return NextResponse.json({ error: "course_id обязателен" }, { status: 400 });

  // Verify ownership of both goal and course
  const [{ data: goal }, { data: course }] = await Promise.all([
    supabaseServer!.from("professional_goals").select("id").eq("id", goalId).eq("user_id", userId).single(),
    supabaseServer!.from("professional_courses").select("id").eq("id", body.course_id).eq("user_id", userId).single(),
  ]);
  if (!goal)   return NextResponse.json({ error: "Цель не найдена" },  { status: 404 });
  if (!course) return NextResponse.json({ error: "Курс не найден" },   { status: 404 });

  const { error } = await supabaseServer!
    .from("professional_goal_courses")
    .insert({ goal_id: goalId, course_id: body.course_id, user_id: userId });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Курс уже связан с этой целью" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ goal_id: goalId, course_id: body.course_id }, { status: 201 });
}

// DELETE /api/professional-development/goals/[id]/courses?course_id=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id: goalId } = await params;
  const courseId = req.nextUrl.searchParams.get("course_id");
  if (!courseId) return NextResponse.json({ error: "course_id обязателен" }, { status: 400 });

  const { error } = await supabaseServer!
    .from("professional_goal_courses")
    .delete()
    .eq("goal_id", goalId)
    .eq("course_id", courseId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
