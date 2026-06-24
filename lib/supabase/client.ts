/**
 * Browser-safe Supabase client (anon key).
 * Currently unused — all data operations go through server API routes.
 * Prepared for future use (e.g. auth, realtime subscriptions).
 *
 * DO NOT use this to read/write clients or any sensitive clinical data.
 * Those go through /api/* routes which use supabase/server.ts.
 */

import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseClient = (url && anon)
  ? createClient(url, anon)
  : null;
