/**
 * SERVER-ONLY: Auth helpers for API routes.
 * Verifies the user's JWT from the Authorization header.
 * Returns null if no valid session — callers should return 401.
 */

import { NextRequest } from "next/server";
import { supabaseServer } from "./server";

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  if (!supabaseServer) return null;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function serviceUnavailable() {
  return Response.json({ error: "Database not configured" }, { status: 503 });
}
