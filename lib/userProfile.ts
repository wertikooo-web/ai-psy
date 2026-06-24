/**
 * Client-safe: no fs imports.
 * Types + pure helpers used by both server store and client components.
 */

export interface UserProfile {
  firstName:            string;
  lastName:             string;
  displayName:          string;
  specialization:       string;
  approach?:            string;
  email?:               string;
  defaultAnalysisMode?: string;
  photoUrl?:            string;   // base64 data URL, max ~200×200
  aiModel?:             string;
}

export const AI_MODELS = [
  { value: "gpt-4o",          label: "GPT-4o",          desc: "Баланс скорость / качество" },
  { value: "gpt-4o-mini",     label: "GPT-4o mini",     desc: "Быстрый и дешёвый" },
  { value: "gpt-4.5-preview", label: "GPT-4.5 Preview", desc: "Самый мощный" },
  { value: "o4-mini",         label: "o4-mini",          desc: "Аналитическое мышление" },
];

export const DEFAULT_PROFILE: UserProfile = {
  firstName:      "",
  lastName:       "",
  displayName:    "",
  specialization: "",
  email:          "",
};

export function resolveDisplayName(p: UserProfile): string {
  if (p.displayName?.trim()) return p.displayName.trim();
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ");
  if (full) return full;
  return "Психолог";
}

export function resolveInitials(p: UserProfile): string {
  const f = p.firstName?.[0]?.toUpperCase() ?? "";
  const l = p.lastName?.[0]?.toUpperCase() ?? "";
  if (f && l) return f + l;
  if (f) return f;
  if (p.displayName?.trim()) return p.displayName.trim()[0].toUpperCase();
  return "П";
}
