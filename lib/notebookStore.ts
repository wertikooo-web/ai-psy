// In-memory store for psychologist's personal notebook.
// TODO: migrate to Supabase `notebook` table for persistence on Railway.

export interface NotebookEntry {
  id:        string;
  text:      string;
  createdAt: string;
}

const store: NotebookEntry[] = [];

export function getNotebookEntries(): NotebookEntry[] {
  return [...store].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addNotebookEntry(entry: NotebookEntry): void {
  store.unshift(entry);
}

export function deleteNotebookEntry(id: string): void {
  const idx = store.findIndex((e) => e.id === id);
  if (idx >= 0) store.splice(idx, 1);
}
