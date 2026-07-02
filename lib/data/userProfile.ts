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
    analysisStyle:        ((row.analysis_style as string)  || "professional") as UserProfile["analysisStyle"],
    analysisLength:       ((row.analysis_length as string) || "standard")     as UserProfile["analysisLength"],
    chatStyle:            ((row.chat_style as string)      || "normal")        as UserProfile["chatStyle"],
    aiInstructions:       (row.ai_instructions as string)       ?? "",
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
    if (profile.analysisStyle       !== undefined) patch.analysis_style        = profile.analysisStyle;
    if (profile.analysisLength      !== undefined) patch.analysis_length       = profile.analysisLength;
    if (profile.chatStyle           !== undefined) patch.chat_style            = profile.chatStyle;
    if (profile.aiInstructions      !== undefined) patch.ai_instructions       = profile.aiInstructions;

    const { error } = await supabaseServer!
      .from("user_profile")
      .upsert({ id: "default", ...patch }, { onConflict: "id" });

    if (error) {
      // 42703 = column does not exist — migration 020 not yet applied in this Supabase instance.
      // Retry without the newer profile columns so core fields (name, AI settings) still save.
      if (error.code === "42703") {
        const safePatch: Record<string, unknown> = {
          updated_at:           patch.updated_at,
          ...(patch.first_name            !== undefined && { first_name:            patch.first_name            }),
          ...(patch.last_name             !== undefined && { last_name:             patch.last_name             }),
          ...(patch.display_name          !== undefined && { display_name:          patch.display_name          }),
          ...(patch.default_analysis_mode !== undefined && { default_analysis_mode: patch.default_analysis_mode }),
          ...(patch.ai_model              !== undefined && { ai_model:              patch.ai_model              }),
          ...(patch.analysis_style        !== undefined && { analysis_style:        patch.analysis_style        }),
          ...(patch.analysis_length       !== undefined && { analysis_length:       patch.analysis_length       }),
          ...(patch.chat_style            !== undefined && { chat_style:            patch.chat_style            }),
          ...(patch.ai_instructions       !== undefined && { ai_instructions:       patch.ai_instructions       }),
        };
        console.warn("PROFILE_SAVE: migration 020 not applied, retrying without newer columns. Run supabase/migrations/020_user_profile_profile_fields.sql in your Supabase SQL editor.");
        const { error: retryErr } = await supabaseServer!
          .from("user_profile")
          .upsert({ id: "default", ...safePatch }, { onConflict: "id" });
        if (retryErr) throw new Error(retryErr.message);
        return;
      }
      console.error("PROFILE_SAVE_FAILED", {
        code:    error.code,
        message: error.message,
        details: error.details,
        hint:    error.hint,
      });
      throw new Error(error.message);
    }
    return;
  }
  await jsonStore.writeProfile(profile);
}
