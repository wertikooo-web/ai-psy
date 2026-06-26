/**
 * One-time setup endpoint — creates Supabase Storage buckets.
 * Call once after deploy: GET /api/setup
 * Safe to call multiple times (idempotent).
 */
import { NextResponse } from "next/server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const BUCKETS = [
  { name: "audio",       public: false },
  { name: "voice-notes", public: false },
  { name: "materials",   public: false },
];

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const results: Record<string, string> = {};

  for (const bucket of BUCKETS) {
    // Check if bucket exists first
    const { data: existing } = await supabaseServer!.storage.getBucket(bucket.name);
    if (existing) {
      results[bucket.name] = "already exists";
      continue;
    }

    const { error } = await supabaseServer!.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: 524_288_000, // 500 MB
    });

    results[bucket.name] = error ? `error: ${error.message}` : "created";
  }

  return NextResponse.json({ ok: true, buckets: results });
}
