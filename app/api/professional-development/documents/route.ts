import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthenticatedUserId, unauthorized, serviceUnavailable } from "@/lib/supabase/auth";
import { uploadToStorage } from "@/lib/supabase/storage";

const BUCKET          = "professional-development";
const MAX_BYTES       = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME    = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-Ѐ-ӿ]/g, "_").slice(0, 200);
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  const sp       = req.nextUrl.searchParams;
  const docType  = sp.get("document_type");
  const courseId = sp.get("course_id");

  let query = supabaseServer!
    .from("professional_documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (docType)  query = query.eq("document_type", docType);
  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized();
  if (!isSupabaseConfigured()) return serviceUnavailable();

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Ожидается multipart/form-data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });

  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Файл превышает 20 МБ" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Недопустимый тип файла" }, { status: 400 });

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });

  const docId       = crypto.randomUUID();
  const safeFile    = safeName(file.name);
  const storagePath = `${userId}/documents/${docId}/${safeFile}`;

  const buffer    = Buffer.from(await file.arrayBuffer());
  const uploadUrl = await uploadToStorage(BUCKET, storagePath, buffer, file.type);
  if (!uploadUrl) return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });

  const { data, error } = await supabaseServer!
    .from("professional_documents")
    .insert({
      id:            docId,
      user_id:       userId,
      document_type: formData.get("document_type")  || "certificate",
      title,
      organization:  formData.get("organization")   || null,
      issued_date:   formData.get("issued_date")    || null,
      expires_at:    formData.get("expires_at")     || null,
      hours:         formData.get("hours")           ? Number(formData.get("hours")) : null,
      course_id:     formData.get("course_id")      || null,
      session_id:    formData.get("session_id")     || null,
      storage_path:  storagePath,
      file_name:     file.name,
      mime_type:     file.type,
      file_size:     file.size,
      notes:         formData.get("notes")          || null,
    })
    .select()
    .single();

  if (error) {
    // Best-effort cleanup of orphaned file
    await supabaseServer!.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
