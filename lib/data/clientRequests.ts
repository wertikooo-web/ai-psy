/**
 * DAL — client_requests. SERVER ONLY.
 *
 * Atomic current-swap operations use PostgreSQL RPC functions defined in
 * migration 009_rpc_client_requests.sql to avoid race conditions that
 * Supabase JS multi-query patterns cannot prevent.
 *
 * clients.concern is intentionally NOT read or written here — it remains
 * a legacy field until a separate verified migration step clears it.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import type { ClientRequest, ClientRequestSource } from "@/lib/types";

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToClientRequest(row: Record<string, unknown>): ClientRequest {
  return {
    id:                   row.id as string,
    clientId:             row.client_id as string,
    text:                 row.text as string,
    isCurrent:            row.is_current as boolean,
    source:               row.source as ClientRequestSource,
    originConsultationId: (row.origin_consultation_id as string) ?? undefined,
    comment:              (row.comment as string) ?? undefined,
    previousText:         (row.previous_text as string) ?? undefined,
    createdAt:            row.created_at as string,
    updatedAt:            (row.updated_at as string) ?? undefined,
    deletedAt:            (row.deleted_at as string) ?? undefined,
  };
}

// ── Guards ────────────────────────────────────────────────────────────────────

function assertSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("[DAL/clientRequests] Supabase is not configured");
  }
}

function assertNonEmptyText(text: string, fn: string): void {
  if (!text || text.trim() === "") {
    throw new Error(`[DAL/${fn}] request text must not be empty`);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * All non-deleted requests for a client, oldest first (chronological history).
 */
export async function getClientRequests(clientId: string): Promise<ClientRequest[]> {
  assertSupabase();
  const { data, error } = await supabaseServer!
    .from("client_requests")
    .select("*")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[DAL/getClientRequests] ${error.message}`);
  return (data ?? []).map(r => rowToClientRequest(r as Record<string, unknown>));
}

/**
 * The single current request for a client, or null if none exists.
 */
export async function getCurrentClientRequest(clientId: string): Promise<ClientRequest | null> {
  assertSupabase();
  const { data, error } = await supabaseServer!
    .from("client_requests")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`[DAL/getCurrentClientRequest] ${error.message}`);
  return data ? rowToClientRequest(data as Record<string, unknown>) : null;
}

/**
 * Returns the id of the current request for use when creating a new consultation.
 * Returns null if the client has no current request yet.
 */
export async function getRequestIdForNewConsultation(clientId: string): Promise<string | null> {
  const current = await getCurrentClientRequest(clientId);
  return current?.id ?? null;
}

// ── Write: "Новый запрос" ─────────────────────────────────────────────────────

export interface CreateClientRequestInput {
  clientId:              string;
  text:                  string;
  source:                ClientRequestSource;   // 'initial' | 'new_request' (not 'edit')
  originConsultationId?: string;
  comment?:              string;
  makeCurrent:           boolean;
}

/**
 * Creates a new request record.
 *
 * When makeCurrent=true, uses the atomic RPC function to swap is_current
 * in a single DB transaction — no race window.
 *
 * When makeCurrent=false, inserts without touching existing current
 * (used for seeding/import scenarios).
 */
export async function createClientRequest(
  input: CreateClientRequestInput,
): Promise<ClientRequest> {
  assertSupabase();
  assertNonEmptyText(input.text, "createClientRequest");

  if (input.source === "edit") {
    throw new Error(
      "[DAL/createClientRequest] source='edit' is not valid for creating a new record — use updateClientRequestText() instead",
    );
  }

  if (input.makeCurrent) {
    // Atomic swap via PostgreSQL function (migration 009)
    const { data: newId, error: rpcError } = await supabaseServer!.rpc(
      "create_current_client_request",
      {
        p_client_id:              input.clientId,
        p_text:                   input.text.trim(),
        p_source:                 input.source,
        p_origin_consultation_id: input.originConsultationId ?? null,
        p_comment:                input.comment ?? null,
      },
    );
    if (rpcError) throw new Error(`[DAL/createClientRequest] ${rpcError.message}`);

    // Fetch and return the created record
    const { data, error } = await supabaseServer!
      .from("client_requests")
      .select("*")
      .eq("id", newId as string)
      .single();
    if (error) throw new Error(`[DAL/createClientRequest] fetch after create: ${error.message}`);
    return rowToClientRequest(data as Record<string, unknown>);
  }

  // makeCurrent=false — simple insert, no swap needed
  const { data, error } = await supabaseServer!
    .from("client_requests")
    .insert({
      id:                    randomUUID(),
      client_id:             input.clientId,
      text:                  input.text.trim(),
      is_current:            false,
      source:                input.source,
      origin_consultation_id: input.originConsultationId ?? null,
      comment:               input.comment ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`[DAL/createClientRequest] ${error.message}`);
  return rowToClientRequest(data as Record<string, unknown>);
}

// ── Write: "Изменить" (уточнение формулировки) ───────────────────────────────

/**
 * Edits the text of an existing request in place.
 *
 * This is the "Уточнить формулировку" action:
 *   - does NOT create a new record
 *   - saves the old text in previous_text
 *   - sets source='edit', updated_at=now()
 *   - is_current and request_id on consultations are unchanged
 *
 * Guards:
 *   - text must be non-empty
 *   - record must not be soft-deleted
 *   - record must belong to the given clientId (ownership check)
 */
export async function updateClientRequestText(
  requestId: string,
  newText:   string,
  clientId:  string,   // required for ownership validation
): Promise<ClientRequest> {
  assertSupabase();
  assertNonEmptyText(newText, "updateClientRequestText");

  // Fetch to validate ownership and soft-delete status
  const { data: existing, error: fetchError } = await supabaseServer!
    .from("client_requests")
    .select("*")
    .eq("id", requestId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) throw new Error(`[DAL/updateClientRequestText] ${fetchError.message}`);
  if (!existing)  throw new Error(`[DAL/updateClientRequestText] request ${requestId} not found or deleted`);

  const row = existing as Record<string, unknown>;
  if (row.client_id !== clientId) {
    throw new Error(`[DAL/updateClientRequestText] request ${requestId} does not belong to client ${clientId}`);
  }

  const { data, error } = await supabaseServer!
    .from("client_requests")
    .update({
      previous_text: row.text,           // preserve old formulation
      text:          newText.trim(),
      source:        "edit" as const,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw new Error(`[DAL/updateClientRequestText] ${error.message}`);
  return rowToClientRequest(data as Record<string, unknown>);
}

// ── Write: switch current ─────────────────────────────────────────────────────

/**
 * Makes an existing (non-deleted) request the current one for this client.
 * Uses atomic RPC — the old current is unset in the same DB transaction.
 *
 * Guards:
 *   - request must belong to clientId (enforced by RPC + ownership check here)
 *   - request must not be soft-deleted (enforced by RPC)
 */
export async function setCurrentClientRequest(
  clientId:  string,
  requestId: string,
): Promise<void> {
  assertSupabase();

  const { error } = await supabaseServer!.rpc("set_current_client_request", {
    p_client_id:  clientId,
    p_request_id: requestId,
  });
  if (error) throw new Error(`[DAL/setCurrentClientRequest] ${error.message}`);
}

// ── Write: soft delete ────────────────────────────────────────────────────────

/**
 * Soft-deletes a request. Sets deleted_at = now().
 *
 * Guards:
 *   - cannot delete the current request (would leave client without a current)
 *   - record must belong to clientId
 *
 * If the psychologist wants to delete the current request, they must first
 * call setCurrentClientRequest() to promote another one, then delete.
 */
export async function softDeleteClientRequest(
  requestId: string,
  clientId:  string,
): Promise<void> {
  assertSupabase();

  // Fetch to validate
  const { data: existing, error: fetchError } = await supabaseServer!
    .from("client_requests")
    .select("id, client_id, is_current, deleted_at")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError) throw new Error(`[DAL/softDeleteClientRequest] ${fetchError.message}`);
  if (!existing)  throw new Error(`[DAL/softDeleteClientRequest] request ${requestId} not found`);

  const row = existing as Record<string, unknown>;

  if (row.client_id !== clientId) {
    throw new Error(`[DAL/softDeleteClientRequest] request ${requestId} does not belong to client ${clientId}`);
  }
  if (row.deleted_at !== null) {
    return; // already deleted — idempotent
  }
  if (row.is_current === true) {
    throw new Error(
      `[DAL/softDeleteClientRequest] cannot delete the current request — promote another request first`,
    );
  }

  const { error } = await supabaseServer!
    .from("client_requests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(`[DAL/softDeleteClientRequest] ${error.message}`);
}

// ── Re-export aliases used by the read-only step (migration 008) ──────────────
// Keep old names working so nothing breaks if they were imported elsewhere.

/** @deprecated use getCurrentClientRequest */
export const getCurrentRequest     = getCurrentClientRequest;

/** @deprecated use getClientRequests */
export const getRequestsForClient  = getClientRequests;
