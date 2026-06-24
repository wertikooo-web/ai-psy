/**
 * DAL — client_history. SERVER ONLY.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/clientHistoryStore";
import type { ClientHistoryItem } from "@/lib/types";

function rowToItem(row: Record<string, unknown>): ClientHistoryItem {
  return {
    id:        row.id as string,
    clientId:  row.client_id as string,
    section:   row.section as ClientHistoryItem["section"],
    text:      row.text as string,
    source:    row.source as ClientHistoryItem["source"],
    sessionId: row.session_id as string | undefined,
    createdAt: row.created_at as string,
  };
}

export async function getHistoryForClient(clientId: string): Promise<ClientHistoryItem[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("client_history")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`[DAL/getHistoryForClient] ${error.message}`);
    return (data ?? []).map(rowToItem);
  }
  return jsonStore.getForClient(clientId);
}

export async function addHistoryItem(item: ClientHistoryItem): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_history")
      .insert({
        id:         item.id,
        client_id:  item.clientId,
        section:    item.section,
        text:       item.text,
        source:     item.source,
        session_id: item.sessionId ?? null,
      });
    if (error) throw new Error(`[DAL/addHistoryItem] ${error.message}`);
    return;
  }
  await jsonStore.addItem(item);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_history")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`[DAL/deleteHistoryItem] ${error.message}`);
    return;
  }
  await jsonStore.deleteItem(id);
}

export async function deleteHistoryForClient(clientId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_history")
      .delete()
      .eq("client_id", clientId);
    if (error) throw new Error(`[DAL/deleteHistoryForClient] ${error.message}`);
    return;
  }
  await jsonStore.deleteForClient(clientId);
}
