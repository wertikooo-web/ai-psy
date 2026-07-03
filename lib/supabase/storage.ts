/**
 * SERVER-ONLY: Supabase Storage helpers.
 * Buckets: 'audio', 'voice-notes', 'materials'
 *
 * Storage URL scheme used internally: storage://<bucket>/<path>
 * Example: storage://audio/1234567890-session.mp3
 */

import { supabaseServer, isSupabaseConfigured } from "./server";

/** Upload buffer to a bucket. Returns internal storage:// URL or null on failure. */
export async function uploadToStorage(
  bucket: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { error } = await supabaseServer!.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`[storage] upload error (${bucket}/${storagePath}):`, error.message);
    return null;
  }

  return `storage://${bucket}/${storagePath}`;
}

/**
 * Download a file from storage and return as Buffer.
 * Accepts internal storage:// URL or a bucket+path pair.
 */
export async function downloadFromStorage(storageUrl: string): Promise<Buffer | null> {
  if (!isSupabaseConfigured()) return null;

  // Parse storage://bucket/path
  const match = storageUrl.match(/^storage:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, bucket, storagePath] = match;

  const { data, error } = await supabaseServer!.storage
    .from(bucket)
    .download(storagePath);

  if (error || !data) {
    console.error(`[storage] download error (${bucket}/${storagePath}):`, error?.message);
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

/** Remove a file from storage. Accepts storage:// URL. */
export async function deleteFromStorage(storageUrl: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const match = storageUrl.match(/^storage:\/\/([^/]+)\/(.+)$/);
  if (!match) return;
  const [, bucket, storagePath] = match;

  await supabaseServer!.storage.from(bucket).remove([storagePath]);
}

/** Check if a URL is a Supabase Storage URL */
export function isStorageUrl(url: string): boolean {
  return url.startsWith("storage://");
}

/** Create a signed URL for temporary access to a private file. */
export async function createSignedUrl(
  bucket: string,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabaseServer!.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    console.error(`[storage] signed URL error (${bucket}/${storagePath}):`, error?.message);
    return null;
  }

  return data.signedUrl;
}

/** Remove a file by bucket + path directly (not storage:// URL). */
export async function deleteFromBucket(bucket: string, storagePath: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseServer!.storage.from(bucket).remove([storagePath]);
  if (error) console.error(`[storage] delete error (${bucket}/${storagePath}):`, error.message);
}
