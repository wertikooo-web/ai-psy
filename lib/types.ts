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
  | "ai_chat"           // Сохранённый AI-диалог из панели чата консультации
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

// ─── client_requests ─────────────────────────────────────────────────────────

export type ClientRequestSource = "initial" | "edit" | "new_request";

export interface ClientRequest {
  id:                   string;
  clientId:             string;
  text:                 string;
  isCurrent:            boolean;
  source:               ClientRequestSource;
  originConsultationId?: string;   // on which consultation the new request appeared
  comment?:             string;    // psychologist's note about the context of change
  previousText?:        string;    // previous formulation, filled when source='edit'
  createdAt:            string;    // ISO
  updatedAt?:           string;    // ISO, filled when source='edit'
  deletedAt?:           string;    // ISO, soft delete
}

// ─── professional_courses ────────────────────────────────────────────────────

export type ProfCourseCategory =
  | "long_program" | "qualification" | "specialization"
  | "intensive" | "webinar" | "seminar" | "conference"
  | "masterclass" | "online_course" | "other";

export type ProfCourseFormat = "online" | "offline" | "hybrid";

export type ProfCourseStatus =
  | "planned" | "in_progress" | "completed" | "paused" | "not_completed";

export interface ProfCourse {
  id:                  string;
  userId:              string;
  title:               string;
  provider?:           string;
  teacher?:            string;
  category:            ProfCourseCategory;
  format:              ProfCourseFormat;
  status:              ProfCourseStatus;
  startDate?:          string;  // date: YYYY-MM-DD
  endDate?:            string;
  totalHours?:         number;
  completedHours?:     number;
  cost?:               number;
  currency:            string;
  url?:                string;
  description?:        string;
  skills?:             string;
  notes?:              string;
  certificateReceived: boolean;
  createdAt:           string;
  updatedAt:           string;
}

// ─── professional_sessions ────────────────────────────────────────────────────

export type ProfSessionType =
  | "supervision" | "intervision" | "balint_group"
  | "clinical_case" | "methodology_group" | "other";

export type ProfSessionFormat = "online" | "offline" | "hybrid";
export type ProfGroupMode    = "individual" | "group";
export type ConfidentialityMode = "anonymous" | "initials" | "linked_client";

export interface ProfSession {
  id:                        string;
  userId:                    string;
  sessionType:               ProfSessionType;
  sessionDate:               string;  // ISO
  durationMinutes?:          number;
  supervisorName?:           string;
  organization?:             string;
  format:                    ProfSessionFormat;
  groupOrIndividual:         ProfGroupMode;
  cost?:                     number;
  currency:                  string;
  topic?:                    string;
  requestSummary?:           string;
  mainInsights?:             string;
  supervisorRecommendations?: string;
  nextSteps?:                string;
  nextSessionDate?:          string;
  relatedClientId?:          string;
  confidentialityMode:       ConfidentialityMode;
  createdAt:                 string;
  updatedAt:                 string;
}

// ─── professional_personal_therapy ───────────────────────────────────────────

export interface ProfPersonalTherapy {
  id:              string;
  userId:          string;
  sessionDate:     string;  // ISO
  durationMinutes?: number;
  therapistName?:  string;
  format:          ProfSessionFormat;
  cost?:           number;
  currency:        string;
  notes?:          string;
  createdAt:       string;
  updatedAt:       string;
}

// ─── professional_goals ───────────────────────────────────────────────────────

export type ProfGoalStatus = "planned" | "in_progress" | "completed" | "postponed";

export interface ProfGoal {
  id:          string;
  userId:      string;
  title:       string;
  description?: string;
  motivation?:  string;
  status:      ProfGoalStatus;
  targetDate?: string;  // date: YYYY-MM-DD
  completedAt?: string; // ISO
  progress:    number;  // 0–100
  createdAt:   string;
  updatedAt:   string;
  courses?:    ProfCourse[];  // populated join
}

// ─── professional_documents ───────────────────────────────────────────────────

export type ProfDocumentType =
  | "certificate" | "diploma" | "qualification" | "program"
  | "receipt" | "contract" | "supervision_confirmation" | "other";

export interface ProfDocument {
  id:           string;
  userId:       string;
  documentType: ProfDocumentType;
  title:        string;
  organization?: string;
  issuedDate?:  string;  // date: YYYY-MM-DD
  expiresAt?:   string;
  hours?:       number;
  courseId?:    string;
  sessionId?:   string;
  storagePath:  string;
  fileName:     string;
  mimeType?:    string;
  fileSize?:    number;
  notes?:       string;
  createdAt:    string;
  updatedAt:    string;
}

// ─── professional development overview ───────────────────────────────────────

export interface ProfDevOverview {
  learningHoursThisYear:   number;
  supervisionHoursThisYear: number;
  coursesInProgress:       number;
  certificatesTotal:       number;
  nextEvent?:              { title: string; date: string };
  recentCourses:           ProfCourse[];
  recentSessions:          ProfSession[];
  recentDocuments:         ProfDocument[];
  activeGoals:             ProfGoal[];
}

// ─── calendar event categories (extended) ────────────────────────────────────

export type CalendarEventCategory =
  | "client_session"
  | "professional_course"
  | "supervision"
  | "intervision"
  | "conference"
  | "learning_deadline"
  | "personal_therapy"
  | "other_professional";

// ─── label maps ──────────────────────────────────────────────────────────────

export const PROF_COURSE_CATEGORY_LABELS: Record<ProfCourseCategory, string> = {
  long_program:   "Долгосрочная программа",
  qualification:  "Повышение квалификации",
  specialization: "Специализация",
  intensive:      "Интенсив",
  webinar:        "Вебинар",
  seminar:        "Семинар",
  conference:     "Конференция",
  masterclass:    "Мастер-класс",
  online_course:  "Онлайн-курс",
  other:          "Другое",
};

export const PROF_COURSE_STATUS_LABELS: Record<ProfCourseStatus, string> = {
  planned:       "Запланирован",
  in_progress:   "В процессе",
  completed:     "Завершён",
  paused:        "Приостановлен",
  not_completed: "Не завершён",
};

export const PROF_SESSION_TYPE_LABELS: Record<ProfSessionType, string> = {
  supervision:       "Супервизия",
  intervision:       "Интервизия",
  balint_group:      "Балинтовская группа",
  clinical_case:     "Клинический разбор",
  methodology_group: "Методическая группа",
  other:             "Другое",
};

export const PROF_DOCUMENT_TYPE_LABELS: Record<ProfDocumentType, string> = {
  certificate:              "Сертификат",
  diploma:                  "Диплом",
  qualification:            "Свидетельство о квалификации",
  program:                  "Программа обучения",
  receipt:                  "Чек / квитанция",
  contract:                 "Договор",
  supervision_confirmation: "Подтверждение супервизии",
  other:                    "Другое",
};

export const PROF_GOAL_STATUS_LABELS: Record<ProfGoalStatus, string> = {
  planned:     "Запланировано",
  in_progress: "В работе",
  completed:   "Достигнуто",
  postponed:   "Отложено",
};

export const CALENDAR_EVENT_CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  client_session:     "Консультация",
  professional_course:"Обучение",
  supervision:        "Супервизия",
  intervision:        "Интервизия",
  conference:         "Конференция",
  learning_deadline:  "Дедлайн",
  personal_therapy:   "Личная терапия",
  other_professional: "Проф. событие",
};

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
  gpt_analysis:     "Анализ GPT",
  past_transcript:  "Транскрипт новой встречи",
  ai_chat:          "AI-диалог сессии",
  other:            "Другое",
};

export const HISTORY_SECTIONS_ORDER: HistorySection[] = [
  "main_topics",
  "significant_events",
  "resources",
];
