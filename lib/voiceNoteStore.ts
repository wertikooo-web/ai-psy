import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export interface VoiceNote {
  id:              string;
  createdAt:       string;
  durationSec:     number;
  audioPath?:      string;        // storage://... (Supabase) or /uploads/... (local)
  audioDeleted?:   boolean;       // true after audio-only deletion; text kept
  text?:           string;        // transcription result
  clientId?:       string;
  clientName?:     string;
  consultationId?: string;
  consultationTitle?: string;
}

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "voice-notes.json");

export async function readVoiceNotes(): Promise<VoiceNote[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveVoiceNote(note: VoiceNote): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const notes = await readVoiceNotes();
  notes.unshift(note);
  await writeFile(DATA_FILE, JSON.stringify(notes, null, 2), "utf-8");
}

export async function deleteVoiceNote(id: string): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const notes = await readVoiceNotes();
  await writeFile(DATA_FILE, JSON.stringify(notes.filter((n) => n.id !== id), null, 2), "utf-8");
}

export async function updateVoiceNote(id: string, patch: Partial<VoiceNote>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const notes = await readVoiceNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx !== -1) notes[idx] = { ...notes[idx], ...patch };
  await writeFile(DATA_FILE, JSON.stringify(notes, null, 2), "utf-8");
}
