/**
 * DAL — consultation_chat_messages. SERVER ONLY.
 * Supabase-only: no local JSON fallback (chat history is non-critical,
 * gracefully degrades to empty if Supabase is unavailable).
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export interface ChatMessageRow {
  id:              string;
  consultation_id: string;
  role:            "user" | "assistant";
  content:         string;
  created_at:      string;
}

export async function getChatMessages(
  consultationId: string,
): Promise<ChatMessageRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseServer!
    .from("consultation_chat_messages")
    .select("id, consultation_id, role, content, created_at")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[DAL/getChatMessages] ${error.message}`);
  return (data ?? []) as ChatMessageRow[];
}

export async function saveChatMessages(
  consultationId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  if (!isSupabaseConfigured() || messages.length === 0) return;
  const rows = messages.map((m) => ({
    consultation_id: consultationId,
    role:            m.role,
    content:         m.content,
  }));
  const { error } = await supabaseServer!
    .from("consultation_chat_messages")
    .insert(rows);
  if (error) throw new Error(`[DAL/saveChatMessages] ${error.message}`);
}

export async function getChatMessageCounts(
  consultationIds: string[],
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured() || consultationIds.length === 0) return {};
  const { data, error } = await supabaseServer!
    .from("consultation_chat_messages")
    .select("consultation_id")
    .in("consultation_id", consultationIds);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as Record<string, string>).consultation_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function clearChatMessages(consultationId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseServer!
    .from("consultation_chat_messages")
    .delete()
    .eq("consultation_id", consultationId);
  if (error) throw new Error(`[DAL/clearChatMessages] ${error.message}`);
}
