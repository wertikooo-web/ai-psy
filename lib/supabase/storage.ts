/**
 * SERVER-ONLY: Supabase Storage helpers.
 * Buckets: 'voice-notes', 'materials'
 */

import { supabaseServer, isSupabaseConfigured } from "./server";

export async function uploadToStorage(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { error } = await supabaseServer!.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`[storage] upload error (${bucket}/${path}):`, error.message);
    return null;
  }

  const { data } = supabaseServer!.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFromStorage(bucket: string, path: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabaseServer!.storage.from(bucket).remove([path]);
}
