/**
 * Canonical data model.
 * Local storage: flat JSON files in /data/.
 * Future: Supabase tables named identically (snake_case).
 */

// ─── clients ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;               // uuid | "c1"–"c5" for mock
  name: string;
  initials: string;
  color: string;
  age?: number;
  concern: string;
  status: "active" | "paused" | "completed";
  createdAt: string;        // ISO
  // Supabase: user_id uuid references auth.users
}

// ─── sessions ────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  clientId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;       // ISO
  status: "uploaded" | "in_progress" | "analyzed";
  // Supabase: user_id uuid references auth.users
}

// ─── session_analyses ────────────────────────────────────────────────────────

export interface SessionAnalysis {
  id: string;
  sessionId: string;
  clientId: string;
  content: string;          // full AI response text
  model: string;            // e.g. "o4-mini"
  promptTokens: number;
  completionTokens: number;
  createdAt: string;        // ISO
  // Supabase: user_id uuid references auth.users
}

// ─── client_history_items ────────────────────────────────────────────────────

export type HistorySection =
  | "main_topics"         // Основные темы
  | "hypotheses"          // Рабочие гипотезы
  | "resources"           // Ресурсы клиента
  | "significant_events"  // Значимые события
  | "explored"            // Что уже исследовали
  | "needs_clarification" // Что требует уточнения
  | "notes";              // Важные заметки психолога

export type HistoryItemSource = "ai" | "manual";

export interface ClientHistoryItem {
  id: string;
  clientId: string;
  section: HistorySection;
  text: string;
  source: HistoryItemSource;  // "ai" = сгенерировано моделью | "manual" = добавлено психологом
  sessionId?: string;         // filled when source === "ai"
  createdAt: string;          // ISO
  // Supabase: user_id uuid references auth.users
}

// ─── client_materials ────────────────────────────────────────────────────────

export type MaterialType =
  | "general_history"   // Общая история клиента
  | "therapist_notes"   // Заметки психолога (личные, не в AI)
  | "observation"       // Наблюдение по клиенту (из FAB, участвует в AI)
  | "gpt_analysis"      // Старые анализы GPT
  | "past_transcript"   // Транскрипт прошлой встречи
  | "other";            // Другое

export interface ClientMaterial {
  id: string;
  clientId: string;
  type: MaterialType;
  title: string;        // short label, auto-derived from type if empty
  content: string;      // pasted text; "" means transcription in progress
  fileName?: string;    // if uploaded as file
  fileUrl?: string;
  createdAt: string;    // ISO
  consultationId?: string; // optional link to a specific consultation
  status?: "transcribing" | "error" | "done"; // client-side only, not persisted
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const HISTORY_SECTION_LABELS: Record<HistorySection, string> = {
  main_topics:         "Основные темы",
  hypotheses:          "Рабочие гипотезы",
  resources:           "Ресурсы клиента",
  significant_events:  "Значимые события",
  explored:            "Что уже исследовали",
  needs_clarification: "Что требует уточнения",
  notes:               "Важные заметки психолога",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  general_history:  "Общая история клиента",
  therapist_notes:  "Заметки психолога",
  observation:      "Наблюдение",
  gpt_analysis:     "Старый анализ GPT",
  past_transcript:  "Транскрипт прошлой встречи",
  other:            "Другое",
};

export const HISTORY_SECTIONS_ORDER: HistorySection[] = [
  "main_topics",
  "hypotheses",
  "resources",
  "significant_events",
  "explored",
  "needs_clarification",
  "notes",
];
