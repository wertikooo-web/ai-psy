/**
 * DAL — user_profile. SERVER ONLY.
 * Single row with id = 'default'.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as jsonStore from "@/lib/userProfileStore";
import type { UserProfile } from "@/lib/userProfile";
import { DEFAULT_PROFILE } from "@/lib/userProfile";

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    firstName:            (row.first_name as string)            ?? "",
    lastName:             (row.last_name as string)             ?? "",
    displayName:          (row.display_name as string)          ?? "",
    specialization:       (row.specialization as string)        ?? "",
    approach:             (row.approach as string)              ?? undefined,
    email:                (row.email as string)                 ?? undefined,
    defaultAnalysisMode:  (row.default_analysis_mode as string) ?? "working",
    photoUrl:             (row.photo_url as string)             ?? undefined,
    aiModel:              (row.ai_model as string)              ?? "gpt-4o",
  };
}

export async function readProfile(): Promise<UserProfile> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("user_profile")
      .select("*")
      .eq("id", "default")
      .single();
    if (error || !data) return DEFAULT_PROFILE;
    return rowToProfile(data);
  }
  return jsonStore.readProfile();
}

export async function writeProfile(profile: Partial<UserProfile>): Promise<void> {
  if (isSupabaseConfigured()) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (profile.firstName           !== undefined) patch.first_name            = profile.firstName;
    if (profile.lastName            !== undefined) patch.last_name             = profile.lastName;
    if (profile.displayName         !== undefined) patch.display_name          = profile.displayName;
    if (profile.specialization      !== undefined) patch.specialization        = profile.specialization;
    if (profile.approach            !== undefined) patch.approach              = profile.approach;
    if (profile.email               !== undefined) patch.email                 = profile.email;
    if (profile.defaultAnalysisMode !== undefined) patch.default_analysis_mode = profile.defaultAnalysisMode;
    if (profile.photoUrl            !== undefined) patch.photo_url             = profile.photoUrl;
    if (profile.aiModel             !== undefined) patch.ai_model              = profile.aiModel;

    const { error } = await supabaseServer!
      .from("user_profile")
      .upsert({ id: "default", ...patch });
    if (error) throw new Error(`[DAL/writeProfile] ${error.message}`);
    return;
  }
  await jsonStore.writeProfile(profile);
}
