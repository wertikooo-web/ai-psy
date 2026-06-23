import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "consultations.json");

export interface StoredConsultation {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  status: "uploaded";
}

export async function readAll(): Promise<StoredConsultation[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as StoredConsultation[];
  } catch {
    return [];
  }
}

async function writeAll(data: StoredConsultation[]): Promise<void> {
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
