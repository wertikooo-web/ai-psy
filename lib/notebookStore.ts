// In-memory store for psychologist's personal notebook.
// TODO: migrate to Supabase `notebook` table for persistence on Railway.

export interface NotebookEntry {
  id:         string;
  title:      string;
  text:       string;
  attentionStatus: NoteAttentionStatus;
  clientId?:  string;
  clientName?: string;
  clientInitials?: string;
  clientColor?: string;
  topic?:     string;
  tags:       string[];
  createdAt:  string;
  updatedAt:  string;
  deletedAt?: string;
}

export type NoteAttentionStatus = "none" | "later" | "important" | "urgent" | "done";

const store: NotebookEntry[] = [];

export function getNotebookEntries(): NotebookEntry[] {
  return store.filter((entry) => !entry.deletedAt).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addNotebookEntry(entry: NotebookEntry): void {
  store.unshift(entry);
}

export function deleteNotebookEntry(id: string): void {
  const idx = store.findIndex((e) => e.id === id);
  if (idx >= 0) store[idx] = { ...store[idx], deletedAt: new Date().toISOString() };
}

export function updateNotebookEntry(id: string, patch: Partial<NotebookEntry>): NotebookEntry | null {
  const idx = store.findIndex((e) => e.id === id && !e.deletedAt);
  if (idx < 0) return null;
  store[idx] = { ...store[idx], ...patch, updatedAt: new Date().toISOString() };
  return store[idx];
}
