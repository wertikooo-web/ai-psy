import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { ClientHistoryItem } from "./types";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "client-history.json");

export type { ClientHistoryItem };

export async function readAll(): Promise<ClientHistoryItem[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as ClientHistoryItem[];
  } catch {
    return [];
  }
}

async function writeAll(data: ClientHistoryItem[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function getForClient(clientId: string): Promise<ClientHistoryItem[]> {
  const all = await readAll();
  return all.filter((i) => i.clientId === clientId);
}

export async function addItem(item: ClientHistoryItem): Promise<void> {
  const all = await readAll();
  all.push(item);
  await writeAll(all);
}

export async function deleteItem(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((i) => i.id !== id));
}

export async function deleteForClient(clientId: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((i) => i.clientId !== clientId));
}
