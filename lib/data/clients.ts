/**
 * Data Access Layer — clients.
 * SERVER ONLY (uses supabase/server.ts + lib/clientStore.ts fallback).
 *
 * Priority:
 *   1. Supabase (if NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set)
 *   2. JSON file fallback (lib/clientStore.ts) — legacy, for local dev without Supabase
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/clientStore";
import type { StoredClient, ClientStatus } from "@/lib/clientStore";

// ── Supabase row → StoredClient ───────────────────────────────────────────────
// Maps snake_case DB columns to the camelCase shape used throughout the app.
function rowToClient(row: Record<string, unknown>): StoredClient {
  return {
    id:                 row.id as string,
    name:               row.full_name as string,
    initials:           (row.initials as string) ?? initials(row.full_name as string),
    color:              (row.color as string) ?? "#6088ff",
    age:                row.age as number | undefined,
    concern:            (row.concern as string) ?? "",
    status:             (row.status as ClientStatus) ?? "active",
    createdAt:          row.created_at as string,
    totalConsultations: (row.sessions_count as number) ?? 0,
    lastConsultation:   (row.last_session_date as string) ?? "",
    mainTopics:         (row.main_topics as string[]) ?? [],
    lastShift:          "",
    currentFocus:       (row.concern as string) ?? "",
  };
}

function initials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getClients(): Promise<StoredClient[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`[DAL/getClients] ${error.message}`);
    return (data ?? []).map(rowToClient);
  }
  return jsonStore.readAll();
}

export async function getClientById(id: string): Promise<StoredClient | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("clients")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) return null;
    return rowToClient(data);
  }
  const all = await jsonStore.readAll();
  return all.find(c => c.id === id) ?? null;
}

export async function createClient(input: {
  name: string;
  age?: number;
  concern?: string;
  color: string;
  initials: string;
}): Promise<StoredClient> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("clients")
      .insert({
        full_name:   input.name,
        initials:    input.initials,
        color:       input.color,
        age:         input.age ?? null,
        concern:     input.concern ?? "",
        status:      "active",
        main_topics: [],
      })
      .select()
      .single();

    if (error) throw new Error(`[DAL/createClient] ${error.message}`);
    return rowToClient(data);
  }
  // JSON fallback
  const { randomUUID } = await import("crypto");
  const client: StoredClient = {
    id:                 randomUUID(),
    name:               input.name,
    initials:           input.initials,
    color:              input.color,
    age:                input.age,
    concern:            input.concern ?? "",
    status:             "active",
    createdAt:          new Date().toISOString(),
    totalConsultations: 0,
    lastConsultation:   new Date().toISOString().slice(0, 10),
    mainTopics:         [],
    lastShift:          "",
    currentFocus:       input.concern ?? "",
  };
  await jsonStore.addClient(client);
  return client;
}

export async function updateClientStatus(id: string, status: ClientStatus): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("clients")
      .update({ status })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(`[DAL/updateClientStatus] ${error.message}`);
    return;
  }
  await jsonStore.updateClientStatus(id, status);
}

export async function pauseClient(id: string)   { return updateClientStatus(id, "paused");   }
export async function archiveClient(id: string) { return updateClientStatus(id, "archived"); }
export async function restoreClient(id: string) { return updateClientStatus(id, "active");   }

export async function softDeleteClient(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(`[DAL/softDeleteClient] ${error.message}`);
    return;
  }
  // JSON fallback: physical delete (no soft-delete in old store)
  await jsonStore.deleteClient(id);
}
