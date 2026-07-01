import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase/server";

export async function markTelegramUpdateProcessed(updateId: number): Promise<boolean> {
  if (!Number.isFinite(updateId)) return false;
  if (!isSupabaseConfigured()) return true;

  const { error } = await supabaseServer!
    .from("telegram_processed_updates")
    .insert({ update_id: updateId });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`[DAL/markTelegramUpdateProcessed] ${error.message}`);
}
