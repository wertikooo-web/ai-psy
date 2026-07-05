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
    if (profile.approach            !== undefined) patch.approach              = profile.approach || null;
    if (profile.email               !== undefined) patch.email                 = profile.email || null;
    if (profile.defaultAnalysisMode !== undefined) patch.default_analysis_mode = profile.defaultAnalysisMode;
    if (profile.photoUrl            !== undefined) patch.photo_url             = profile.photoUrl || null;
    if (profile.aiModel             !== undefined) patch.ai_model              = profile.aiModel;
    if (profile.analysisStyle       !== undefined) patch.analysis_style        = profile.analysisStyle;
    if (profile.analysisLength      !== undefined) patch.analysis_length       = profile.analysisLength;
    if (profile.chatStyle           !== undefined) patch.chat_style            = profile.chatStyle;
    if (profile.aiInstructions      !== undefined) patch.ai_instructions       = profile.aiInstructions;

    const { error } = await supabaseServer!
      .from("user_profile")
      .upsert({ id: "default", ...patch }, { onConflict: "id" });

    if (error) {
      // Handle missing-column errors:
      //   42703 = PostgreSQL "column does not exist"
      //   PGRST204 / schema cache = PostgREST can't find the column in its schema cache
      // In both cases retry with only the always-present base columns.
      const isColumnMissing =
        error.code === "42703" ||
        (typeof error.message === "string" && error.message.includes("schema cache"));

      if (isColumnMissing) {
        // Base columns guaranteed to exist since migration 001/012.
        // Newer columns (ai_instructions, specialization, approach, email, photo_url)
        // are excluded — they require migrations 003/020 to be applied first.
        const safePatch: Record<string, unknown> = { updated_at: patch.updated_at };
        if (patch.first_name            !== undefined) safePatch.first_name            = patch.first_name;
        if (patch.last_name             !== undefined) safePatch.last_name             = patch.last_name;
        if (patch.display_name          !== undefined) safePatch.display_name          = patch.display_name;
        if (patch.default_analysis_mode !== undefined) safePatch.default_analysis_mode = patch.default_analysis_mode;
        if (patch.ai_model              !== undefined) safePatch.ai_model              = patch.ai_model;
        if (patch.analysis_style        !== undefined) safePatch.analysis_style        = patch.analysis_style;
        if (patch.analysis_length       !== undefined) safePatch.analysis_length       = patch.analysis_length;
        if (patch.chat_style            !== undefined) safePatch.chat_style            = patch.chat_style;

        console.warn(
          "PROFILE_SAVE: missing columns detected (run migrations 003 and 020 in Supabase SQL editor). " +
          `Error code: ${error.code}, msg: ${error.message}`
        );
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
