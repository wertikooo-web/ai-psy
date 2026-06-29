/**
 * DAL — calendar_events. SERVER ONLY.
 * Supabase-first; returns empty array if Supabase is not configured.
 */

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EventStatus  = "planned" | "completed" | "cancelled" | "no_show";
export type EventFormat  = "online" | "offline";
export type SyncStatus   = "none" | "synced" | "pending" | "error" | "missing_remote";

export interface CalendarEvent {
  id:               string;
  clientId?:        string;
  clientName:       string;
  consultationId?:  string;
  title:            string;
  startsAt:         string;   // ISO 8601 UTC
  endsAt:           string;   // ISO 8601 UTC
  timezone:         string;
  status:           EventStatus;
  format:           EventFormat;
  location?:        string;
  notes?:           string;
  syncStatus:       SyncStatus;
  googleEventId?:   string;
  googleCalendarId?: string;
  createdAt:        string;
  updatedAt:        string;
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id:               row.id            as string,
    clientId:         (row.client_id    as string) || undefined,
    clientName:       (row.client_name  as string) ?? "",
    consultationId:   (row.consultation_id as string) || undefined,
    title:            (row.title        as string) ?? "",
    startsAt:         row.starts_at     as string,
    endsAt:           row.ends_at       as string,
    timezone:         (row.timezone     as string) ?? "Europe/Chisinau",
    status:           (row.status       as EventStatus) ?? "planned",
    format:           (row.format       as EventFormat) ?? "online",
    location:         (row.location     as string) || undefined,
    notes:            (row.notes        as string) || undefined,
    syncStatus:       (row.sync_status  as SyncStatus) ?? "none",
    googleEventId:    (row.google_event_id   as string) || undefined,
    googleCalendarId: (row.google_calendar_id as string) || undefined,
    createdAt:        row.created_at    as string,
    updatedAt:        row.updated_at    as string,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Fetch events whose starts_at falls between [from, to] (ISO strings). */
export async function getCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabaseServer!
    .from("calendar_events")
    .select("*")
    .is("deleted_at", null)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`[DAL/getCalendarEvents] ${error.message}`);
  return (data ?? []).map((r) => rowToEvent(r as Record<string, unknown>));
}

export async function getCalendarEvent(id: string): Promise<CalendarEvent | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabaseServer!
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return rowToEvent(data as Record<string, unknown>);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface CreateCalendarEventInput {
  clientId?:  string;
  clientName: string;
  title:      string;
  startsAt:   string;
  endsAt:     string;
  timezone:   string;
  format:     EventFormat;
  location?:  string;
  notes?:     string;
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const { data, error } = await supabaseServer!
    .from("calendar_events")
    .insert({
      client_id:   input.clientId ?? null,
      client_name: input.clientName,
      title:       input.title,
      starts_at:   input.startsAt,
      ends_at:     input.endsAt,
      timezone:    input.timezone,
      format:      input.format,
      location:    input.location ?? null,
      notes:       input.notes    ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`[DAL/createCalendarEvent] ${error.message}`);
  return rowToEvent(data as Record<string, unknown>);
}

export interface UpdateCalendarEventInput {
  clientId?:       string | null;
  clientName?:     string;
  consultationId?: string | null;
  title?:          string;
  startsAt?:       string;
  endsAt?:         string;
  status?:         EventStatus;
  format?:         EventFormat;
  location?:       string | null;
  notes?:          string | null;
}

export async function updateCalendarEvent(
  id: string,
  updates: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("clientId"       in updates) patch.client_id       = updates.clientId       ?? null;
  if ("clientName"     in updates) patch.client_name     = updates.clientName;
  if ("consultationId" in updates) patch.consultation_id = updates.consultationId  ?? null;
  if ("title"          in updates) patch.title           = updates.title;
  if ("startsAt"       in updates) patch.starts_at       = updates.startsAt;
  if ("endsAt"         in updates) patch.ends_at         = updates.endsAt;
  if ("status"         in updates) patch.status          = updates.status;
  if ("format"         in updates) patch.format          = updates.format;
  if ("location"       in updates) patch.location        = updates.location        ?? null;
  if ("notes"          in updates) patch.notes           = updates.notes           ?? null;

  const { data, error } = await supabaseServer!
    .from("calendar_events")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`[DAL/updateCalendarEvent] ${error.message}`);
  return rowToEvent(data as Record<string, unknown>);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabaseServer!
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`[DAL/deleteCalendarEvent] ${error.message}`);
}
