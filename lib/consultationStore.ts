import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "consultations.json");

export type ConsultationSource = "audio" | "transcript" | "notes";
export type ConsultationStatus = "created" | "transcribing" | "ready" | "analyzing" | "done" | "error";
export type TranscriptOrigin   = "whisper" | "file" | "manual";

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

  // Populated after Whisper (audio) or immediately (transcript/notes)
  transcript?: {
    text: string;
    origin: TranscriptOrigin;
    fileName?: string;
    createdAt: string;
  };

  // One entry per analysis run
  analyses?: Array<{
    id: string;
    mode: string;
    result: string;
    createdAt: string;
  }>;

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
