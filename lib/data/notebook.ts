/**
 * DAL — notebook. SERVER ONLY.
 * Supabase when configured, in-memory fallback otherwise.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";
import * as memStore from "@/lib/notebookStore";
import type { NotebookEntry } from "@/lib/notebookStore";

export const NOTEBOOK_PAGE_SIZE = 3;

export type NotebookSort = "newest" | "oldest" | "updated" | "client" | "topic";
export type NotebookGroup = "none" | "date" | "client" | "topic";
export type NotebookDateFilter = "all" | "today" | "7d" | "30d" | "custom";

export interface NotebookQuery {
  page: number;
  search?: string;
  client?: string;
  topic?: string;
  tags?: string[];
  sort: NotebookSort;
  group: NotebookGroup;
  date: NotebookDateFilter;
  from?: string;
  to?: string;
}

export interface NotebookPageResult {
  entries: NotebookEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotebookInput {
  title?: string;
  text: string;
  clientId?: string;
  topic?: string;
  tags?: string[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function rowToEntry(row: Record<string, unknown>): NotebookEntry {
  const client = row.clients as Record<string, unknown> | null | undefined;
  const hasTitleColumn = Object.prototype.hasOwnProperty.call(row, "title");
  const rawText = (row.text as string | null) ?? "";
  const legacy = hasTitleColumn ? { title: (row.title as string | null) ?? "", text: rawText } : parseLegacyNotebookText(rawText);
  return {
    id:         row.id as string,
    title:      legacy.title,
    text:       legacy.text,
    clientId:   (row.client_id as string | null) ?? undefined,
    clientName: (client?.full_name as string | undefined) ?? undefined,
    topic:      (row.topic as string | null) ?? undefined,
    tags:       asStringArray(row.tags),
    createdAt:  row.created_at as string,
    updatedAt:  (row.updated_at as string | null) ?? (row.created_at as string),
    deletedAt:  (row.deleted_at as string | null) ?? undefined,
  };
}

function normalizeTags(tags?: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 32);
    if (tag) seen.add(tag);
    if (seen.size >= 8) break;
  }
  return [...seen];
}

function sanitizeFilterText(value: string): string {
  return value.replace(/[(),{}]/g, " ").replace(/\s+/g, " ").trim();
}

function parseLegacyNotebookText(text: string): { title: string; text: string } {
  const match = text.match(/^\[\[notebook-title:(.*?)\]\]\n\n([\s\S]*)$/);
  if (!match) return { title: "", text };
  return { title: match[1].trim(), text: match[2] ?? "" };
}

function formatLegacyNotebookText(input: NotebookInput): string {
  const title = input.title?.trim() ?? "";
  const text = input.text.trim();
  return title ? `[[notebook-title:${title}]]\n\n${text}` : text;
}

function isMissingNotebookV2Schema(message: string): boolean {
  return (
    message.includes("deleted_at") ||
    message.includes("updated_at") ||
    message.includes("client_id") ||
    message.includes("topic") ||
    message.includes("tags") ||
    message.includes("title") ||
    message.includes("Could not find") ||
    message.includes("does not exist")
  );
}

function applyDateFilter<T extends { createdAt: string }>(entries: T[], query: NotebookQuery): T[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date | null = null;
  let to: Date | null = null;

  if (query.date === "today") from = startOfToday;
  if (query.date === "7d") from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (query.date === "30d") from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (query.date === "custom") {
    from = query.from ? new Date(query.from) : null;
    to = query.to ? new Date(`${query.to}T23:59:59`) : null;
  }

  return entries.filter((entry) => {
    const created = new Date(entry.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
}

function sortEntries(entries: NotebookEntry[], sort: NotebookSort): NotebookEntry[] {
  return [...entries].sort((a, b) => {
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sort === "client") return (a.clientName ?? "").localeCompare(b.clientName ?? "", "ru");
    if (sort === "topic") return (a.topic ?? "").localeCompare(b.topic ?? "", "ru");
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

async function getClientIdsByName(search: string): Promise<string[]> {
  if (!isSupabaseConfigured() || !search) return [];
  const { data } = await supabaseServer!
    .from("clients")
    .select("id")
    .ilike("full_name", `%${search}%`)
    .is("deleted_at", null);
  return (data ?? []).map((row) => row.id as string);
}

export async function getEntries(query: NotebookQuery): Promise<NotebookPageResult> {
  const page = Math.max(1, query.page || 1);

  if (isSupabaseConfigured()) {
    const from = (page - 1) * NOTEBOOK_PAGE_SIZE;
    const to = from + NOTEBOOK_PAGE_SIZE - 1;
    const search = sanitizeFilterText((query.search ?? "").trim());
    const clientIds = search ? await getClientIdsByName(search) : [];
    let request = supabaseServer!
      .from("notebook")
      .select("*, clients:client_id(full_name)", { count: "exact" })
      .is("deleted_at", null);

    if (search) {
      const clauses = [
        `title.ilike.%${search}%`,
        `text.ilike.%${search}%`,
        `topic.ilike.%${search}%`,
        `tags.cs.{${search}}`,
      ];
      if (clientIds.length) clauses.push(`client_id.in.(${clientIds.join(",")})`);
      request = request.or(clauses.join(","));
    }

    if (query.client === "none") request = request.is("client_id", null);
    else if (query.client) request = request.eq("client_id", query.client);
    if (query.topic) request = request.eq("topic", query.topic);
    if (query.tags?.length) request = request.contains("tags", query.tags);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (query.date === "today") request = request.gte("created_at", today.toISOString());
    if (query.date === "7d") request = request.gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    if (query.date === "30d") request = request.gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    if (query.date === "custom") {
      if (query.from) request = request.gte("created_at", new Date(query.from).toISOString());
      if (query.to) request = request.lte("created_at", new Date(`${query.to}T23:59:59`).toISOString());
    }

    if (query.sort === "oldest") request = request.order("created_at", { ascending: true });
    else if (query.sort === "updated") request = request.order("updated_at", { ascending: false });
    else if (query.sort === "client") request = request.order("client_id", { ascending: true, nullsFirst: false });
    else if (query.sort === "topic") request = request.order("topic", { ascending: true, nullsFirst: false });
    else request = request.order("created_at", { ascending: false });

    const { data, error, count } = await request.range(from, to);
    if (error) {
      if (isMissingNotebookV2Schema(error.message)) {
        return getLegacyEntries(query);
      }
      throw new Error(`[DAL/notebook/getEntries] ${error.message}`);
    }
    const total = count ?? 0;
    return {
      entries: (data ?? []).map(rowToEntry),
      page,
      pageSize: NOTEBOOK_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / NOTEBOOK_PAGE_SIZE)),
    };
  }

  const search = (query.search ?? "").toLowerCase();
  let entries = memStore.getNotebookEntries();
  entries = entries.filter((entry) => {
    if (query.client === "none" && entry.clientId) return false;
    if (query.client && query.client !== "none" && entry.clientId !== query.client) return false;
    if (query.topic && entry.topic !== query.topic) return false;
    if (query.tags?.length && !query.tags.every((tag) => entry.tags.includes(tag))) return false;
    if (!search) return true;
    return [entry.title, entry.text, entry.clientName, entry.topic, ...entry.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  entries = applyDateFilter(entries, query);
  entries = sortEntries(entries, query.sort);
  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / NOTEBOOK_PAGE_SIZE));
  return {
    entries: entries.slice((page - 1) * NOTEBOOK_PAGE_SIZE, page * NOTEBOOK_PAGE_SIZE),
    page,
    pageSize: NOTEBOOK_PAGE_SIZE,
    total,
    totalPages,
  };
}

async function getLegacyEntries(query: NotebookQuery): Promise<NotebookPageResult> {
  const page = Math.max(1, query.page || 1);
  const from = (page - 1) * NOTEBOOK_PAGE_SIZE;
  const to = from + NOTEBOOK_PAGE_SIZE - 1;
  let request = supabaseServer!
    .from("notebook")
    .select("id,text,created_at", { count: "exact" });

  const search = sanitizeFilterText((query.search ?? "").trim());
  if (search) request = request.ilike("text", `%${search}%`);
  request = query.sort === "oldest"
    ? request.order("created_at", { ascending: true })
    : request.order("created_at", { ascending: false });

  const { data, error, count } = await request.range(from, to);
  if (error) throw new Error(`[DAL/notebook/getLegacyEntries] ${error.message}`);
  const total = count ?? 0;
  return {
    entries: (data ?? []).map(rowToEntry),
    page,
    pageSize: NOTEBOOK_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / NOTEBOOK_PAGE_SIZE)),
  };
}

export async function getEntryById(id: string): Promise<NotebookEntry | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("notebook")
      .select("*, clients:client_id(full_name)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      if (isMissingNotebookV2Schema(error.message)) {
        const legacy = await supabaseServer!
          .from("notebook")
          .select("id,text,created_at")
          .eq("id", id)
          .single();
        return legacy.data ? rowToEntry(legacy.data as Record<string, unknown>) : null;
      }
      return null;
    }
    return data ? rowToEntry(data as Record<string, unknown>) : null;
  }

  return memStore.getNotebookEntries().find((entry) => entry.id === id) ?? null;
}

export async function addEntry(input: NotebookInput & { id: string }): Promise<NotebookEntry> {
  const entry: NotebookEntry = {
    id:        input.id,
    title:     input.title?.trim() ?? "",
    text:      input.text.trim(),
    clientId:  input.clientId || undefined,
    topic:     input.topic?.trim() || undefined,
    tags:      normalizeTags(input.tags),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("notebook")
      .insert({
        id:         entry.id,
        title:      entry.title,
        text:       entry.text,
        client_id:  entry.clientId ?? null,
        topic:      entry.topic ?? null,
        tags:       entry.tags,
      })
      .select("*, clients:client_id(full_name)")
      .single();
    if (error) {
      if (isMissingNotebookV2Schema(error.message)) {
        const legacy = await supabaseServer!
          .from("notebook")
          .insert({ id: entry.id, text: formatLegacyNotebookText(input) })
          .select("id,text,created_at")
          .single();
        if (legacy.error) throw new Error(`[DAL/notebook/addEntryLegacy] ${legacy.error.message}`);
        return rowToEntry(legacy.data as Record<string, unknown>);
      }
      throw new Error(`[DAL/notebook/addEntry] ${error.message}`);
    }
    return rowToEntry(data as Record<string, unknown>);
  }

  memStore.addNotebookEntry(entry);
  return entry;
}

export async function updateEntry(id: string, input: NotebookInput): Promise<NotebookEntry | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseServer!
      .from("notebook")
      .update({
        title:      input.title?.trim() ?? "",
        text:       input.text.trim(),
        client_id:  input.clientId || null,
        topic:      input.topic?.trim() || null,
        tags:       normalizeTags(input.tags),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*, clients:client_id(full_name)")
      .single();
    if (error) {
      if (isMissingNotebookV2Schema(error.message)) {
        const legacy = await supabaseServer!
          .from("notebook")
          .update({ text: formatLegacyNotebookText(input) })
          .eq("id", id)
          .select("id,text,created_at")
          .single();
        if (legacy.error) throw new Error(`[DAL/notebook/updateEntryLegacy] ${legacy.error.message}`);
        return legacy.data ? rowToEntry(legacy.data as Record<string, unknown>) : null;
      }
      throw new Error(`[DAL/notebook/updateEntry] ${error.message}`);
    }
    return data ? rowToEntry(data as Record<string, unknown>) : null;
  }

  return memStore.updateNotebookEntry(id, {
    title:    input.title?.trim() ?? "",
    text:     input.text.trim(),
    clientId: input.clientId || undefined,
    topic:    input.topic?.trim() || undefined,
    tags:     normalizeTags(input.tags),
  });
}

export async function deleteEntry(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!
      .from("notebook")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      if (isMissingNotebookV2Schema(error.message)) {
        const legacy = await supabaseServer!
          .from("notebook")
          .delete()
          .eq("id", id);
        if (legacy.error) throw new Error(`[DAL/notebook/deleteEntryLegacy] ${legacy.error.message}`);
        return;
      }
      throw new Error(`[DAL/notebook/deleteEntry] ${error.message}`);
    }
    return;
  }
  memStore.deleteNotebookEntry(id);
}
