import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "clients.json");

export interface StoredClient {
  id: string;
  name: string;
  initials: string;
  color: string;
  age?: number;
  concern: string;
  status: "active" | "paused" | "completed";
  createdAt: string;
  totalConsultations: number;
  lastConsultation: string;
  mainTopics: string[];
  lastShift: string;
  currentFocus: string;
}

export async function readAll(): Promise<StoredClient[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as StoredClient[];
  } catch {
    return [];
  }
}

async function writeAll(data: StoredClient[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function addClient(c: StoredClient) {
  const all = await readAll();
  all.unshift(c);
  await writeAll(all);
}

export async function deleteClient(id: string) {
  const all = await readAll();
  await writeAll(all.filter((c) => c.id !== id));
}
