/**
 * Client-safe: no fs imports.
 * Types + pure helpers used by both server store and client components.
 */

export type AnalysisStyle  = "professional" | "simple" | "academic";
export type AnalysisLength = "brief" | "standard" | "detailed";
export type ChatStyle      = "brief" | "normal" | "detailed";

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
  analysisStyle?:       AnalysisStyle;
  analysisLength?:      AnalysisLength;
  chatStyle?:           ChatStyle;
  aiInstructions?:      string;
}

export const AI_MODELS = [
  { value: "gpt-4o",      label: "GPT-4o",      desc: "Баланс скорость / качество" },
  { value: "gpt-4o-mini", label: "GPT-4o mini", desc: "Быстрый и экономичный" },
  { value: "o4-mini",     label: "o4-mini",     desc: "Аналитическое мышление" },
];

export const ANALYSIS_STYLE_OPTIONS: { value: AnalysisStyle; label: string; hint: string }[] = [
  { value: "professional", label: "Профессиональный", hint: "Живой профессиональный язык без лишней сложности" },
  { value: "simple",       label: "Простой и понятный", hint: "Меньше терминов, проще формулировки" },
  { value: "academic",     label: "Академический", hint: "Строгий язык и более подробная аргументация" },
];

export const ANALYSIS_LENGTH_OPTIONS: { value: AnalysisLength; label: string }[] = [
  { value: "brief",    label: "Краткий" },
  { value: "standard", label: "Стандартный" },
  { value: "detailed", label: "Подробный" },
];

export const CHAT_STYLE_OPTIONS: { value: ChatStyle; label: string }[] = [
  { value: "brief",  label: "Кратко" },
  { value: "normal", label: "Обычно" },
  { value: "detailed", label: "Подробно" },
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
