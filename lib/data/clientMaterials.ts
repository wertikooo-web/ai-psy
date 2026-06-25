/**
 * DAL — client_materials. SERVER ONLY.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/clientMaterialsStore";
import type { ClientMaterial } from "@/lib/types";

function rowToMaterial(row: Record<string, unknown>): ClientMaterial {
  return {
    id:        row.id as string,
    clientId:  row.client_id as string,
    type:      row.type as ClientMaterial["type"],
    title:     row.title as string,
    content:   row.content as string,
    fileName:  row.file_name as string | undefined,
    fileUrl:   row.file_url as string | undefined,
    createdAt: row.created_at as string,
  };
}

export async function getMaterialsForClient(clientId: string): Promise<ClientMaterial[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("client_materials")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`[DAL/getMaterialsForClient] ${error.message}`);
    return (data ?? []).map(rowToMaterial);
  }
  return jsonStore.getForClient(clientId);
}

export async function addMaterial(m: ClientMaterial): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_materials")
      .insert({
        id:        m.id,
        client_id: m.clientId,
        type:      m.type,
        title:     m.title,
        content:   m.content,
        file_name: m.fileName ?? null,
        file_url:  m.fileUrl  ?? null,
      });
    if (error) throw new Error(`[DAL/addMaterial] ${error.message}`);
    return;
  }
  await jsonStore.addMaterial(m);
}

export async function updateMaterial(id: string, updates: Partial<ClientMaterial>): Promise<ClientMaterial | null> {
  if (isSupabaseConfigured()) {
    const patch: Record<string, unknown> = {};
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.title   !== undefined) patch.title   = updates.title;
    const { data, error } = await supabaseServer!
      .from("client_materials")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`[DAL/updateMaterial] ${error.message}`);
    return data ? rowToMaterial(data as Record<string, unknown>) : null;
  }
  return jsonStore.updateMaterial(id, updates);
}

export async function deleteMaterial(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_materials")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`[DAL/deleteMaterial] ${error.message}`);
    return;
  }
  await jsonStore.deleteMaterial(id);
}

export async function deleteMaterialsForClient(clientId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("client_materials")
      .delete()
      .eq("client_id", clientId);
    if (error) throw new Error(`[DAL/deleteMaterialsForClient] ${error.message}`);
    return;
  }
  await jsonStore.deleteForClient(clientId);
}
