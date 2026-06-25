/**
 * DAL — notebook. SERVER ONLY.
 * Supabase when configured, in-memory fallback otherwise.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as memStore from "@/lib/notebookStore";
import type { NotebookEntry } from "@/lib/notebookStore";

function rowToEntry(row: Record<string, unknown>): NotebookEntry {
  return {
    id:        row.id as string,
    text:      row.text as string,
    createdAt: row.created_at as string,
  };
}

export async function getEntries(): Promise<NotebookEntry[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("notebook")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/notebook/getEntries] ${error.message}`);
    return (data ?? []).map(rowToEntry);
  }
  return memStore.getNotebookEntries();
}

export async function addEntry(entry: NotebookEntry): Promise<NotebookEntry> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("notebook")
      .insert({ id: entry.id, text: entry.text })
      .select()
      .single();
    if (error) throw new Error(`[DAL/notebook/addEntry] ${error.message}`);
    return rowToEntry(data as Record<string, unknown>);
  }
  memStore.addNotebookEntry(entry);
  return entry;
}

export async function deleteEntry(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("notebook")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`[DAL/notebook/deleteEntry] ${error.message}`);
    return;
  }
  memStore.deleteNotebookEntry(id);
}
