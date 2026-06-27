/**
 * DAL — client_requests. SERVER ONLY.
 * Read-only for now (migration 008). Write operations added in v2 UI step.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ClientRequest, ClientRequestSource } from "@/lib/types";

function rowToClientRequest(row: Record<string, unknown>): ClientRequest {
  return {
    id:                   row.id as string,
    clientId:             row.client_id as string,
    text:                 row.text as string,
    isCurrent:            row.is_current as boolean,
    source:               row.source as ClientRequestSource,
    originConsultationId: row.origin_consultation_id as string | undefined ?? undefined,
    comment:              row.comment as string | undefined ?? undefined,
    previousText:         row.previous_text as string | undefined ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string | undefined ?? undefined,
    deletedAt:            row.deleted_at as string | undefined ?? undefined,
  };
}

export async function getCurrentRequest(clientId: string): Promise<ClientRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabaseServer!
    .from("client_requests")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data ? rowToClientRequest(data as Record<string, unknown>) : null;
}

export async function getRequestsForClient(clientId: string): Promise<ClientRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseServer!
    .from("client_requests")
    .select("*")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[DAL/getRequestsForClient] ${error.message}`);
  return (data ?? []).map(rowToClientRequest);
}
