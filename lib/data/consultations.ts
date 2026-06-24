/**
 * DAL — consultations. SERVER ONLY.
 * Supabase-first, falls back to lib/consultationStore.ts (JSON).
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/consultationStore";
import type { StoredConsultation } from "@/lib/consultationStore";

function rowToConsultation(row: Record<string, unknown>): StoredConsultation {
  return {
    id:             row.id as string,
    clientId:       (row.client_id as string) ?? "",
    clientName:     (row.client_name as string) ?? "",
    clientInitials: (row.client_initials as string) ?? "",
    clientColor:    (row.client_color as string) ?? "#6088ff",
    title:          (row.title as string) ?? "",
    createdAt:      row.created_at as string,
    source:         (row.source as StoredConsultation["source"]) ?? "audio",
    status:         (row.status as StoredConsultation["status"]) ?? "created",
    audio: row.audio_file_url ? {
      fileName: (row.audio_file_name as string) ?? "",
      fileUrl:  row.audio_file_url as string,
      fileSize: (row.audio_file_size as number) ?? 0,
    } : undefined,
    notes: (row.notes as string) ?? undefined,
    transcript: row.transcript_text ? {
      text:      row.transcript_text as string,
      origin:    (row.transcript_origin as "whisper" | "file" | "manual") ?? "manual",
      fileName:  row.transcript_file_name as string | undefined,
      createdAt: (row.transcript_created_at as string) ?? (row.created_at as string),
    } : undefined,
    analyses: (row.analyses as StoredConsultation["analyses"]) ?? [],
  };
}

function consultationToRow(c: StoredConsultation) {
  return {
    id:                    c.id,
    client_id:             c.clientId || null,
    client_name:           c.clientName,
    client_initials:       c.clientInitials,
    client_color:          c.clientColor,
    title:                 c.title,
    source:                c.source,
    status:                c.status,
    audio_file_name:       c.audio?.fileName ?? null,
    audio_file_url:        c.audio?.fileUrl ?? null,
    audio_file_size:       c.audio?.fileSize ?? null,
    notes:                 c.notes ?? null,
    transcript_text:       c.transcript?.text ?? null,
    transcript_origin:     c.transcript?.origin ?? null,
    transcript_file_name:  c.transcript?.fileName ?? null,
    transcript_created_at: c.transcript?.createdAt ?? null,
    analyses:              c.analyses ?? [],
  };
}

export async function getConsultations(): Promise<StoredConsultation[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("consultations")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getConsultations] ${error.message}`);
    return (data ?? []).map(rowToConsultation);
  }
  return jsonStore.readAll();
}

export async function getConsultation(id: string): Promise<StoredConsultation | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("consultations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) return null;
    return rowToConsultation(data);
  }
  return jsonStore.getConsultation(id);
}

export async function getConsultationsForClient(clientId: string): Promise<StoredConsultation[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("consultations")
      .select("*")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getConsultationsForClient] ${error.message}`);
    return (data ?? []).map(rowToConsultation);
  }
  const all = await jsonStore.readAll();
  return all.filter(c => c.clientId === clientId);
}

export async function addConsultation(c: StoredConsultation): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("consultations")
      .insert(consultationToRow(c));
    if (error) throw new Error(`[DAL/addConsultation] ${error.message}`);
    return;
  }
  await jsonStore.addConsultation(c);
}

export async function updateConsultation(id: string, updates: Partial<StoredConsultation>): Promise<void> {
  if (isSupabaseConfigured()) {
    const patch: Record<string, unknown> = {};
    if (updates.title       !== undefined) patch.title          = updates.title;
    if (updates.status      !== undefined) patch.status         = updates.status;
    if (updates.clientId    !== undefined) patch.client_id      = updates.clientId;
    if (updates.clientName  !== undefined) patch.client_name    = updates.clientName;
    if (updates.analyses    !== undefined) patch.analyses       = updates.analyses;
    if (updates.audio !== undefined) {
      patch.audio_file_name = updates.audio?.fileName ?? null;
      patch.audio_file_url  = updates.audio?.fileUrl  ?? null;
      patch.audio_file_size = updates.audio?.fileSize ?? null;
    }
    if (updates.notes      !== undefined) patch.notes               = updates.notes ?? null;
    if (updates.transcript !== undefined) {
      patch.transcript_text       = updates.transcript?.text       ?? null;
      patch.transcript_origin     = updates.transcript?.origin     ?? null;
      patch.transcript_file_name  = updates.transcript?.fileName   ?? null;
      patch.transcript_created_at = updates.transcript?.createdAt  ?? null;
    }
    const { error } = await supabaseServer!
      .from("consultations")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`[DAL/updateConsultation] ${error.message}`);
    return;
  }
  await jsonStore.updateConsultation(id, updates);
}

export async function softDeleteConsultation(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("consultations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`[DAL/softDeleteConsultation] ${error.message}`);
    return;
  }
  const all = await jsonStore.readAll();
  await jsonStore.writeAll(all.filter(c => c.id !== id));
}

export async function softDeleteConsultationsForClient(clientId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("consultations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("client_id", clientId);
    if (error) throw new Error(`[DAL/softDeleteConsultationsForClient] ${error.message}`);
    return;
  }
  const all = await jsonStore.readAll();
  await jsonStore.writeAll(all.filter(c => c.clientId !== clientId));
}
