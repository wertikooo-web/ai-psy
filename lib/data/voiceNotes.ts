/**
 * DAL — voice_notes. SERVER ONLY.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/voiceNoteStore";
import type { VoiceNote } from "@/lib/voiceNoteStore";

function rowToNote(row: Record<string, unknown>): VoiceNote {
  return {
    id:                 row.id as string,
    createdAt:          row.created_at as string,
    durationSec:        (row.duration_sec as number) ?? 0,
    audioPath:          row.audio_path as string | undefined,
    audioDeleted:       (row.audio_deleted as boolean) ?? false,
    text:               row.text as string | undefined,
    clientId:           row.client_id as string | undefined,
    clientName:         row.client_name as string | undefined,
    consultationId:     row.consultation_id as string | undefined,
    consultationTitle:  row.consultation_title as string | undefined,
  };
}

export async function getVoiceNotes(): Promise<VoiceNote[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("voice_notes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getVoiceNotes] ${error.message}`);
    return (data ?? []).map(rowToNote);
  }
  return jsonStore.readVoiceNotes();
}

export async function getVoiceNotesForClient(clientId: string): Promise<VoiceNote[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("voice_notes")
      .select("*")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getVoiceNotesForClient] ${error.message}`);
    return (data ?? []).map(rowToNote);
  }
  const all = await jsonStore.readVoiceNotes();
  return all.filter(n => n.clientId === clientId);
}

export async function saveVoiceNote(note: VoiceNote): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("voice_notes")
      .insert({
        id:                 note.id,
        duration_sec:       note.durationSec,
        audio_path:         note.audioPath ?? null,
        text:               note.text ?? null,
        client_id:          note.clientId ?? null,
        client_name:        note.clientName ?? null,
        consultation_id:    note.consultationId ?? null,
        consultation_title: note.consultationTitle ?? null,
      });
    if (error) throw new Error(`[DAL/saveVoiceNote] ${error.message}`);
    return;
  }
  await jsonStore.saveVoiceNote(note);
}

export async function updateVoiceNote(id: string, patch: Partial<VoiceNote>): Promise<void> {
  if (isSupabaseConfigured()) {
    const row: Record<string, unknown> = {};
    if (patch.text         !== undefined) row.text          = patch.text;
    if (patch.audioPath    !== undefined) row.audio_path    = patch.audioPath ?? null;
    if (patch.audioDeleted !== undefined) row.audio_deleted = patch.audioDeleted;
    const { error } = await supabaseServer!
      .from("voice_notes")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(`[DAL/updateVoiceNote] ${error.message}`);
    return;
  }
  await jsonStore.updateVoiceNote(id, patch);
}

export async function deleteVoiceNote(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("voice_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`[DAL/deleteVoiceNote] ${error.message}`);
    return;
  }
  await jsonStore.deleteVoiceNote(id);
}
