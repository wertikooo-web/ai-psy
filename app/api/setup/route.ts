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
    const { data: existing } = await supabaseServer!.storage.getBucket(bucket.name);

    if (existing) {
      // Update file size limit on existing bucket
      const { error } = await supabaseServer!.storage.updateBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52_428_800, // 50 MB (Supabase free tier limit)
      });
      results[bucket.name] = error ? `update error: ${error.message}` : "updated";
    } else {
      const { error } = await supabaseServer!.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52_428_800, // 50 MB (Supabase free tier limit)
      });
      results[bucket.name] = error ? `create error: ${error.message}` : "created";
    }
  }

  return NextResponse.json({ ok: true, buckets: results });
}
