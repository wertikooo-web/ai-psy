/**
 * SERVER-ONLY: Auth helpers for API routes.
 *
 * Priority order for user identification:
 *  1. Bearer JWT token in Authorization header (future Supabase Auth)
 *  2. PROF_DEV_USER_ID env var (single-tenant mode — current deployment)
 *
 * Set PROF_DEV_USER_ID to any stable UUID in Railway environment variables.
 * Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 */

import { NextRequest } from "next/server";
import { supabaseServer } from "./server";

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  // 1. Try Bearer token (Supabase Auth)
  if (supabaseServer) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);
      if (!error && user) return user.id;
    }
  }

  // 2. Single-tenant fallback
  const fallback = process.env.PROF_DEV_USER_ID;
  if (fallback) return fallback;

  return null;
}

export function unauthorized() {
  return Response.json(
    { error: "Unauthorized. Set PROF_DEV_USER_ID env var for single-tenant mode." },
    { status: 401 },
  );
}

export function serviceUnavailable() {
  return Response.json({ error: "Database not configured" }, { status: 503 });
}
