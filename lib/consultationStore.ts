import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "consultations.json");

export type ConsultationSource = "audio" | "transcript" | "notes";
export type ConsultationStatus = "created" | "transcribing" | "ready" | "analyzing" | "done" | "error";
export type TranscriptOrigin   = "whisper" | "file" | "manual";

/** Raw segment from Whisper verbose_json */
export interface WhisperSegment {
  id:    number;
  start: number;   // seconds
  end:   number;   // seconds
  text:  string;
}

/** Speaker-assigned segment stored in DB after formatting */
export interface FormattedSegment {
  order_index:   number;
  speaker:       "therapist" | "client" | "unknown";
  start_seconds: number;
  end_seconds:   number;
  text:          string;
}

// ── Analysis Evidence types (spec v1.0) ───────────────────────────────────────

export type EvidenceItem = {
  segmentId?:   string;
  quote:        string;
  speaker:      "client" | "psychologist" | "unknown";
  startSeconds?: number;
  endSeconds?:   number;
  confidence:   "high" | "medium" | "low";
  reason?:      string;
};

export type ThemeEvidence = {
  label:       string;
  occurrences: number;
  evidence:    EvidenceItem[];
  confidence:  "high" | "medium" | "low";
};

export type PhraseEvidence = {
  phrase:      string;
  occurrences: number;
  evidence:    EvidenceItem[];
  confidence:  "high" | "medium" | "low";
};

export type MarkerEvidence = {
  total:    number;
  examples: EvidenceItem[];
};

export type CompressedTranscript = {
  version:     "1.0";
  text:        string;
  sourceHash:  string;
  chunksCount: number;
  createdAt:   string;
  model?:      string;
};

export type AnalysisEvidence = {
  version:     "1.0";
  generatedAt: string;

  source: {
    consultationId:      string;
    transcriptVersion?:  string;
    transcriptUpdatedAt?: string;
    sourceHash:          string;
    hasSpeakerLabels:    boolean;
    hasTimestamps:       boolean;
  };

  quality: {
    speakerSeparation:  "good" | "partial" | "poor" | "unknown";
    transcriptionNoise: "low" | "medium" | "high" | "unknown";
    notes:              string[];
  };

  repeatedThemes:          ThemeEvidence[];
  repeatedPhrases:         PhraseEvidence[];
  uncertaintyMarkers:      MarkerEvidence;
  possibleOffTopicAnswers: EvidenceItem[];
  importantQuotes:         EvidenceItem[];
  possibleTranscriptionIssues: EvidenceItem[];
};

export interface StoredConsultation {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  title: string;
  createdAt: string;

  source: ConsultationSource;
  status: ConsultationStatus;

  // Populated when source === "audio"
  audio?: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
  };

  // Psychologist's own notes (never overwritten by Whisper)
  notes?: string;

  // Whisper / uploaded transcript (populated after audio transcription)
  transcript?: {
    text: string;
    origin: TranscriptOrigin;
    fileName?: string;
    createdAt: string;
  };

  // Raw Whisper segments (from verbose_json, with timestamps)
  transcriptSegments?: WhisperSegment[];

  // Speaker-split segments (saved after GPT formatting)
  transcriptFormatted?: FormattedSegment[];

  // Soft-deletion timestamps for individual parts
  audioDeletedAt?: string;
  transcriptRawDeletedAt?: string;
  transcriptFormattedDeletedAt?: string;

  // One entry per analysis run
  analyses?: Array<{
    id: string;
    mode: string;
    result: string;
    createdAt: string;
    blocks?: import("@/lib/analysisBlocks").AnalysisBlock[];
  }>;

  // Hidden evidence layer — extracted from transcript text, never re-runs Whisper
  analysisEvidence?: AnalysisEvidence;

  // Cached map-reduce compression of long transcripts (rebuilt only when transcript changes)
  compressedTranscript?: CompressedTranscript;

  // Legacy fields — kept for records created before this model change
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export async function readAll(): Promise<StoredConsultation[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as StoredConsultation[];
  } catch {
    return [];
  }
}

export async function writeAll(data: StoredConsultation[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function addConsultation(c: StoredConsultation): Promise<void> {
  const all = await readAll();
  all.unshift(c);
  await writeAll(all);
}

export async function getConsultation(id: string): Promise<StoredConsultation | null> {
  const all = await readAll();
  return all.find((c) => c.id === id) ?? null;
}

export async function updateConsultation(id: string, updates: Partial<StoredConsultation>): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...updates };
  await writeAll(all);
}
