import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";
import { createSignedUrl, deleteFromBucket } from "@/lib/supabase/storage";

const BUCKET = "professional-development";

// GET → returns document metadata + a short-lived signed URL
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;

  const { data, error } = await supabaseServer!
    .from("professional_documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const signedUrl = await createSignedUrl(BUCKET, data.storage_path, 3600);

  return NextResponse.json({ ...data, signed_url: signedUrl });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id: _id, user_id: _uid, storage_path: _sp, file_name: _fn, created_at: _ca, ...patch } = body as Record<string, unknown>;
  void _id; void _uid; void _sp; void _fn; void _ca;

  const { data, error } = await supabaseServer!
    .from("professional_documents")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Не найдено" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const { id } = await params;

  // Fetch storage_path before deleting the record
  const { data: doc } = await supabaseServer!
    .from("professional_documents")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  // Delete DB record first, then file
  const { error } = await supabaseServer!
    .from("professional_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort file removal — don't fail if storage delete fails
  await deleteFromBucket(BUCKET, doc.storage_path);

  return new Response(null, { status: 204 });
}
