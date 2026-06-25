import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ClientMaterial } from "./types";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "client-materials.json");

export type { ClientMaterial };

export async function readAll(): Promise<ClientMaterial[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ClientMaterial[];
  } catch {
    return [];
  }
}

async function writeAll(data: ClientMaterial[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function getForClient(clientId: string): Promise<ClientMaterial[]> {
  const all = await readAll();
  return all.filter((m) => m.clientId === clientId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addMaterial(m: ClientMaterial): Promise<void> {
  const all = await readAll();
  all.unshift(m);
  await writeAll(all);
}

export async function updateMaterial(id: string, updates: Partial<ClientMaterial>): Promise<ClientMaterial | null> {
  const all = await readAll();
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  await writeAll(all);
  return all[idx];
}

export async function deleteMaterial(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((m) => m.id !== id));
}

export async function deleteForClient(clientId: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((m) => m.clientId !== clientId));
}
