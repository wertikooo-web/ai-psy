export type ClientStatus = "active" | "paused" | "completed";
export type ConsultationStatus = "new" | "analyzed" | "in_progress";
export type MessageRole = "user" | "assistant";
export type AnalysisMode = "working" | "deep" | "therapist" | "gestalt";

export interface ClientMap {
  totalConsultations: number;
  therapyDuration: string;
  mainTopics: string[];
  dynamics: { label: string; direction: "up" | "down" }[];
  recentChange: string;
}

export interface DigDeeperCard {
  id: string;
  emoji: string;
  label: string;
  chatPrompt: string;
}

export interface CompareData {
  prevSession: number;
  currSession: number;
  newTopics: string[];
  weakened: string[];
  strengthened: string[];
  requestChange: string;
}

export interface ModeAnalysis {
  working: AnalysisSection[];
  deep: AnalysisSection[];
  therapist: AnalysisSection[];
  gestalt: AnalysisSection[];
}

export interface Client {
  id: string;
  name: string;
  age: number;
  initials: string;
  color: string;
  status: ClientStatus;
  totalConsultations: number;
  lastConsultation: string;
  concern: string;
  // Research-space fields
  mainTopics: string[];
  lastShift: string;
  currentFocus: string;
}

export interface VoiceObservation {
  lead: string;   // "Меня здесь заинтересовало..."
  body: string;   // the actual content
  tags?: string[];
}

export interface TranscriptSegment {
  id: string;
  speaker: "therapist" | "client";
  speakerName: string;
  timestamp: string;
  text: string;
}

export interface AnalysisSection {
  title: string;
  icon: string;
  content: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface Consultation {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  date: string;
  duration: string;
  status: ConsultationStatus;
  sessionNumber: number;
  topic: string;
  summary: string;
  transcript: TranscriptSegment[];
  analysis: AnalysisSection[];
  modeAnalysis?: ModeAnalysis;
  clientMap?: ClientMap;
  digDeeper?: DigDeeperCard[];
  compareData?: CompareData;
  voiceAnalysis?: VoiceObservation[];
  chat: ChatMessage[];
}

// ─── Demo data removed — only real data from /data storage is shown ─────────


export const clients: Client[] = [];

// ─── Consultations ───────────────────────────────────────────────────────────

export const consultations: Consultation[] = [];

export const stats = {
  totalClients: 5,
  activeClients: 3,
  consultationsThisMonth: 8,
  consultationsTotal: 50,
  avgDuration: "52 мин",
  analyzedSessions: 46,
};
