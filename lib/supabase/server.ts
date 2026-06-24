/**
 * SERVER-ONLY Supabase client.
 * Uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS.
 * Import ONLY in:
 *   - app/api/**\/route.ts
 *   - Server Components (no "use client" directive)
 *   - lib/data/**
 *
 * NEVER import in files with "use client" at the top.
 */

import { createClient } from "@supabase/supabase-js";

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  // Only warn — app still runs without Supabase (JSON fallback)
  if (process.env.NODE_ENV === "production") {
    console.warn("[supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
}

export const supabaseServer = (url && secret)
  ? createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export function isSupabaseConfigured(): boolean {
  return supabaseServer !== null;
}
