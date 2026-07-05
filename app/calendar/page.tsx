"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, User,
  Pencil, Trash2, Check, X, LayoutGrid, CalendarDays,
  List, Loader2, Video, Building2, CalendarX, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type EventStatus = "planned" | "completed" | "cancelled" | "no_show";
type EventFormat = "online" | "offline";
type ViewType    = "month" | "week" | "day" | "list";

interface CalendarEvent {
  id:              string;
  clientId?:       string;
  clientName:      string;
  title:           string;
  startsAt:        string;
  endsAt:          string;
  status:          EventStatus;
  format:          EventFormat;
  location?:       string;
  notes?:          string;
}

interface Client {
  id:   string;
  name: string;
}

interface FormState {
  id?:       string;
  clientId:  string;
  title:     string;
  date:      string;
  startTime: string;
  duration:  number;
  format:    EventFormat;
  location:  string;
  notes:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_H        = 64;    // px per hour in week/day view
const DAY_START_H   = 8;     // first hour shown
const DAY_END_H     = 21;    // last hour shown (exclusive label)
const HOUR_COUNT    = DAY_END_H - DAY_START_H;
const GRID_H        = HOUR_COUNT * HOUR_H;

const DURATION_OPTIONS = [
  { label: "30 минут",   value: 30  },
  { label: "45 минут",   value: 45  },
  { label: "50 минут",   value: 50  },
  { label: "60 минут",   value: 60  },
  { label: "90 минут",   value: 90  },
  { label: "2 часа",     value: 120 },
];

const STATUS_META: Record<EventStatus, { label: string; bg: string; text: string; border: string }> = {
  planned:   { label: "Запланирована",       bg: "#E8EEF9", text: "#355E9C", border: "#B8CCF0" },
  completed: { label: "Завершена",           bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
  cancelled: { label: "Отменена",            bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
  no_show:   { label: "Клиент не пришёл",   bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
};

const WEEK_DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const c   = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}
function addMonths(d: Date, n: number): Date {
  const c = new Date(d); c.setMonth(c.getMonth() + n); return c;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function localDateToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}
function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function todayDateStr(): string {
  return dateKey(new Date());
}
function isoToLocalDate(iso: string): string { return dateKey(new Date(iso)); }
function toGCalDate(iso: string): string {
  // "2024-06-15T10:00:00.000Z" → "20240615T100000Z"
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action:   "TEMPLATE",
    text:     event.clientName || event.title,
    dates:    `${toGCalDate(event.startsAt)}/${toGCalDate(event.endsAt)}`,
    ...(event.notes    && { details:  event.notes    }),
    ...(event.location && { location: event.location }),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── Week/day grid helpers ─────────────────────────────────────────────────────

function eventTopPx(startsAt: string): number {
  const d   = new Date(startsAt);
  const min = (d.getHours() - DAY_START_H) * 60 + d.getMinutes();
  return Math.max(0, Math.min((min / 60) * HOUR_H, GRID_H - 20));
}
function eventHeightPx(startsAt: string, endsAt: string): number {
  const ms  = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(20, (ms / 3_600_000) * HOUR_H);
}
function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = dateKey(day);
  return events.filter((e) => isoToLocalDate(e.startsAt) === key);
}

// ── Range label ───────────────────────────────────────────────────────────────

function rangeLabel(view: ViewType, current: Date): string {
  if (view === "month") return `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`;
  if (view === "week") {
    const ws = startOfWeek(current);
    const we = addDays(ws, 6);
    if (ws.getMonth() === we.getMonth())
      return `${ws.getDate()}–${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
    return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${ws.getFullYear()}`;
  }
  if (view === "day") return fmtDateLong(current.toISOString());
  return "Список событий";
}

function computeRange(view: ViewType, current: Date): { from: string; to: string } {
  if (view === "month") {
    const ms = startOfMonth(current);
    const me = endOfMonth(current);
    return {
      from: addDays(startOfWeek(ms), 0).toISOString(),
      to:   addDays(me, 7).toISOString(),
    };
  }
  if (view === "week") {
    const ws = startOfWeek(current);
    return { from: ws.toISOString(), to: addDays(ws, 7).toISOString() };
  }
  if (view === "day") {
    const d = new Date(current); d.setHours(0,0,0,0);
    return { from: d.toISOString(), to: addDays(d, 1).toISOString() };
  }
  // list: next 90 days
  const now = new Date(); now.setHours(0,0,0,0);
  return { from: now.toISOString(), to: addDays(now, 90).toISOString() };
}

function navigate(view: ViewType, current: Date, dir: -1 | 1): Date {
  if (view === "month") return addMonths(current, dir);
  if (view === "week")  return addDays(current, dir * 7);
  if (view === "day")   return addDays(current, dir);
  return current;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

function EventChip({
  event, onClick, compact = false,
}: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const m = STATUS_META[event.status];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left truncate rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
      style={{ background: m.bg, color: m.text, borderLeft: `2px solid ${m.border}` }}
    >
      {compact
        ? (event.clientName || event.title)
        : `${fmtTime(event.startsAt)} ${event.clientName || event.title}`}
    </button>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  events, current, today, onEventClick, onDayClick,
}: {
  events: CalendarEvent[];
  current: Date;
  today: Date;
  onEventClick: (e: CalendarEvent) => void;
  onDayClick:   (d: Date) => void;
}) {
  const monthStart  = startOfMonth(current);
  const calStart    = startOfWeek(monthStart);
  const days        = Array.from({ length: 42 }, (_, i) => addDays(calStart, i));
  const weeks       = Array.from({ length: 6 },  (_, i) => days.slice(i * 7, i * 7 + 7));

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const k = isoToLocalDate(ev.startsAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ev);
    });
    return m;
  }, [events]);

  const curMonth = current.getMonth();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
        {WEEK_DAYS_SHORT.map((d, i) => (
          <div key={d}
            className="py-2 text-center text-xs font-semibold"
            style={{ color: i >= 5 ? "#EF4444" : "#9CA3AF" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid" style={{ gridTemplateRows: "repeat(6, 1fr)" }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-[#E5E7EB] last:border-b-0">
            {week.map((day) => {
              const key        = dateKey(day);
              const dayEvents  = byDay.get(key) ?? [];
              const inCurMonth = day.getMonth() === curMonth;
              const isToday    = isSameDay(day, today);
              const isWeekend  = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={key}
                  onClick={() => onDayClick(day)}
                  className="border-r border-[#E5E7EB] last:border-r-0 p-1.5 cursor-pointer hover:bg-amber-50/40 transition-colors overflow-hidden"
                  style={{
                    background: !inCurMonth ? "#FAFAFA" : isWeekend ? "#FEFEFE" : undefined,
                    opacity:    !inCurMonth ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? "bg-[#4F46E5] text-white" : isWeekend ? "text-red-500" : "text-gray-700"}`}>
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} compact />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3} ещё</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  events, current, today, onEventClick, onSlotClick,
}: {
  events: CalendarEvent[];
  current: Date;
  today:   Date;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick:  (d: Date, h: number) => void;
}) {
  const weekStart = startOfWeek(current);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours     = Array.from({ length: HOUR_COUNT }, (_, i) => DAY_START_H + i);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (9 - DAY_START_H) * HOUR_H; // scroll to 9:00
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-[#E5E7EB]">
      {/* Day headers */}
      <div className="flex border-b border-[#E5E7EB]" style={{ background: "#F0EAE0", paddingLeft: 56 }}>
        {weekDays.map((day, i) => {
          const isToday    = isSameDay(day, today);
          const isWeekend  = i >= 5;
          return (
            <div key={i} className="flex-1 text-center py-2 border-r border-[#F3F4F6] last:border-r-0">
              <div className="text-xs font-semibold mb-0.5"
                style={{ color: isWeekend ? "#EF4444" : "#9CA3AF" }}>
                {WEEK_DAYS_SHORT[i]}
              </div>
              <div className={`text-base font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full
                ${isToday ? "bg-[#4F46E5] text-white" : isWeekend ? "text-red-500" : "text-gray-800"}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: GRID_H }}>
          {/* Time axis */}
          <div className="flex-shrink-0" style={{ width: 56, background: "#F7F3EA" }}>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="flex items-start justify-end pr-2 pt-0.5">
                <span className="text-xs" style={{ color: "#9CA3AF" }}>{h}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const dayEvs = eventsForDay(events, day);
            return (
              <div
                key={di}
                className="flex-1 relative border-r border-[#E8E2D8] last:border-r-0"
                style={{ background: di >= 5 ? "#F5F0E8" : "#FDFCF9" }}
                onClick={(e) => {
                  if ((e.target as HTMLElement) === e.currentTarget) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y    = e.clientY - rect.top;
                    const h    = Math.floor(y / HOUR_H) + DAY_START_H;
                    onSlotClick(day, h);
                  }
                }}
              >
                {/* Hour lines */}
                {hours.map((h) => (
                  <div key={h} style={{ height: HOUR_H }}
                    className="border-b border-[#E8E2D8] cursor-pointer hover:bg-amber-50/20 transition-colors"
                    onClick={() => onSlotClick(day, h)}
                  />
                ))}

                {/* Events */}
                {dayEvs.map((ev) => {
                  const top = eventTopPx(ev.startsAt);
                  const h   = eventHeightPx(ev.startsAt, ev.endsAt);
                  const m   = STATUS_META[ev.status];
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="absolute left-0.5 right-0.5 text-left rounded overflow-hidden z-10 shadow-sm hover:shadow-md transition-shadow"
                      style={{
                        top, height: h,
                        background: m.bg,
                        borderLeft: `3px solid ${m.border}`,
                        color: m.text,
                      }}
                    >
                      <div className="p-1 h-full flex flex-col overflow-hidden">
                        <div className="text-xs font-semibold leading-tight truncate">
                          {ev.clientName || ev.title}
                        </div>
                        {h > 30 && (
                          <div className="text-xs opacity-80 mt-0.5 leading-tight">
                            {fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({
  events, current, today, onEventClick, onSlotClick,
}: {
  events: CalendarEvent[];
  current: Date;
  today:   Date;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick:  (d: Date, h: number) => void;
}) {
  const dayEvs   = eventsForDay(events, current);
  const hours    = Array.from({ length: HOUR_COUNT }, (_, i) => DAY_START_H + i);
  const isToday  = isSameDay(current, today);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = (9 - DAY_START_H) * HOUR_H; }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-t border-[#E5E7EB]">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] py-2 px-4 flex items-center gap-3" style={{ background: "#F0EAE0" }}>
        <span className={`text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full
          ${isToday ? "bg-[#4F46E5] text-white" : "text-gray-800"}`}>
          {current.getDate()}
        </span>
        <div>
          <div className="text-sm font-medium text-gray-800">
            {current.toLocaleDateString("ru-RU", { weekday: "long" })}
          </div>
          <div className="text-xs text-gray-400">
            {current.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: GRID_H }}>
          <div className="flex-shrink-0" style={{ width: 56 }}>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="flex items-start justify-end pr-2 pt-0.5">
                <span className="text-xs text-gray-400">{h}:00</span>
              </div>
            ))}
          </div>
          <div className="flex-1 relative">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_H }}
                className="border-b border-[#F3F4F6] cursor-pointer hover:bg-blue-50/20"
                onClick={() => onSlotClick(current, h)}
              />
            ))}
            {dayEvs.map((ev) => {
              const top = eventTopPx(ev.startsAt);
              const h   = eventHeightPx(ev.startsAt, ev.endsAt);
              const m   = STATUS_META[ev.status];
              return (
                <button
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  className="absolute left-1 right-1 text-left rounded shadow-sm hover:shadow-md transition-shadow z-10"
                  style={{ top, height: h, background: m.bg, borderLeft: `3px solid ${m.border}`, color: m.text }}
                >
                  <div className="p-2">
                    <div className="text-sm font-semibold truncate">{ev.clientName || ev.title}</div>
                    <div className="text-xs opacity-80">{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}</div>
                    {ev.format && (
                      <div className="text-xs opacity-70 mt-0.5">
                        {ev.format === "online" ? "Онлайн" : "Офлайн"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({
  events, onEventClick,
}: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 py-20">
        <CalendarX size={40} strokeWidth={1.3} />
        <p className="text-sm">Нет предстоящих событий</p>
      </div>
    );
  }

  // Group by date
  const groups = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    const k = isoToLocalDate(ev.startsAt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(ev);
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
      {[...groups.entries()].map(([dateStr, evs]) => (
        <div key={dateStr} className="mb-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {new Date(dateStr + "T12:00:00").toLocaleDateString("ru-RU", {
              weekday: "long", day: "numeric", month: "long"
            })}
          </div>
          <div className="space-y-2">
            {evs.map((ev) => {
              const m = STATUS_META[ev.status];
              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left rounded-xl border p-3 hover:shadow-md transition-shadow bg-white"
                  style={{ borderColor: m.border }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{ev.clientName || ev.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> {fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          {ev.format === "online"
                            ? <><Video size={13} /> Онлайн</>
                            : <><Building2 size={13} /> Офлайн</>}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={13} /> {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Event detail modal ────────────────────────────────────────────────────────

function EventDetailModal({
  event, onClose, onEdit, onDelete, onStatusChange,
}: {
  event:          CalendarEvent;
  onClose:        () => void;
  onEdit:         () => void;
  onDelete:       () => void;
  onStatusChange: (s: EventStatus) => void;
}) {
  const m = STATUS_META[event.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Colored top bar */}
        <div className="h-1.5" style={{ background: m.border }} />

        <div className="p-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{event.clientName || event.title}</h2>
              <div className="mt-1"><StatusBadge status={event.status} /></div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
              <X size={18} />
            </button>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock size={14} className="flex-shrink-0 text-gray-400" />
              {fmtDateShort(event.startsAt)}, {fmtTime(event.startsAt)}–{fmtTime(event.endsAt)}
            </div>
            <div className="flex items-center gap-2">
              {event.format === "online"
                ? <><Video size={14} className="text-gray-400" /> Онлайн-консультация</>
                : <><Building2 size={14} className="text-gray-400" /> Офлайн-консультация</>}
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-gray-400" /> {event.location}
              </div>
            )}
            {event.clientId && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" /> {event.clientName}
              </div>
            )}
            {event.notes && (
              <p className="mt-2 text-gray-500 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed">
                {event.notes}
              </p>
            )}
          </div>

          {/* Google Calendar link */}
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 text-sm text-[#4285F4] hover:underline"
          >
            <ExternalLink size={13} />
            Добавить в Google Calendar
          </a>

          {/* Status actions */}
          {event.status === "planned" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => onStatusChange("completed")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors">
                <Check size={13} /> Завершена
              </button>
              <button onClick={() => onStatusChange("cancelled")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
                <X size={13} /> Отменить
              </button>
              <button onClick={() => onStatusChange("no_show")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors">
                <CalendarX size={13} /> Не пришёл
              </button>
            </div>
          )}
          {event.status !== "planned" && (
            <div className="mt-4">
              <button onClick={() => onStatusChange("planned")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors">
                Вернуть в запланированные
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex justify-between items-center">
            <button onClick={onDelete}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
              <Trash2 size={14} /> Удалить
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Закрыть
              </button>
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors">
                <Pencil size={14} /> Редактировать
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Event form modal ──────────────────────────────────────────────────────────

function EventFormModal({
  form, clients, saving, onClose, onSave, onChange,
}: {
  form:     FormState;
  clients:  Client[];
  saving:   boolean;
  onClose:  () => void;
  onSave:   () => void;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const isEdit   = !!form.id;
  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] transition-colors";

  // Auto-fill title from client name when creating
  const handleClientChange = useCallback((clientId: string) => {
    const cl = clients.find((c) => c.id === clientId);
    onChange({ clientId, title: cl ? `Консультация — ${cl.name}` : "" });
  }, [clients, onChange]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? "Редактировать консультацию" : "Новая консультация"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Клиент</label>
            <select className={inputCls} value={form.clientId}
              onChange={(e) => handleClientChange(e.target.value)}>
              <option value="">— Новый клиент —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Название</label>
            <input className={inputCls} type="text" placeholder="Консультация"
              value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>

          {/* Date + time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата</label>
              <input className={inputCls} type="date" value={form.date}
                onChange={(e) => onChange({ date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Начало</label>
              <input className={inputCls} type="time" value={form.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })} />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Длительность</label>
            <select className={inputCls} value={form.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}>
              {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Формат</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(["online","offline"] as EventFormat[]).map((f) => (
                <button key={f}
                  onClick={() => onChange({ format: f })}
                  className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5
                    ${form.format === f ? "bg-[#4F46E5] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {f === "online" ? <><Video size={14} /> Онлайн</> : <><Building2 size={14} /> Офлайн</>}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Место / ссылка</label>
            <input className={inputCls} type="text"
              placeholder={form.format === "online" ? "https://zoom.us/j/..." : "Адрес офиса"}
              value={form.location} onChange={(e) => onChange({ location: e.target.value })} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Заметки</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Необязательно"
              value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Отмена
          </button>
          <button onClick={onSave} disabled={saving || !form.date || !form.startTime}
            className="px-5 py-2 rounded-xl bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 size={17} className="text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900">Удалить событие?</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">Событие будет удалено. Клиент и его материалы не затрагиваются.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Отмена
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      <div className="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-3">
        {msg}
      </div>
    </div>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

const VIEW_OPTS: { value: ViewType; label: string; icon: React.ElementType }[] = [
  { value: "month", label: "Месяц",  icon: LayoutGrid   },
  { value: "week",  label: "Неделя", icon: CalendarDays },
  { value: "day",   label: "День",   icon: Clock        },
  { value: "list",  label: "Список", icon: List         },
];

// ── Default form ──────────────────────────────────────────────────────────────

function defaultForm(date?: Date, hour?: number): FormState {
  const d = date ?? new Date();
  const h = hour ?? 10;
  return {
    clientId:  "",
    title:     "",
    date:      dateKey(d),
    startTime: `${String(h).padStart(2,"0")}:00`,
    duration:  60,
    format:    "online",
    location:  "",
    notes:     "",
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router  = useRouter();
  const today   = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  function handleClose() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const [view,          setView]          = useState<ViewType>("month");
  const [current,       setCurrent]       = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [events,        setEvents]        = useState<CalendarEvent[]>([]);
  const [clients,       setClients]       = useState<Client[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [form,          setForm]          = useState<FormState | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null);
  const [toast,         setToast]         = useState("");

  const { from, to } = useMemo(() => computeRange(view, current), [view, current]);

  // Fetch events on range change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/calendar-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => { if (!cancelled) setEvents(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  // Fetch clients once
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const refreshEvents = useCallback(async () => {
    const r = await fetch(`/api/calendar-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const d = await r.json();
    setEvents(Array.isArray(d) ? d : []);
  }, [from, to]);

  // Open create form
  const openCreate = useCallback((date?: Date, hour?: number) => {
    setSelectedEvent(null);
    setForm(defaultForm(date, hour));
  }, []);

  // Open edit form
  const openEdit = useCallback((ev: CalendarEvent) => {
    setSelectedEvent(null);
    setForm({
      id:        ev.id,
      clientId:  ev.clientId  ?? "",
      title:     ev.title,
      date:      isoToLocalDate(ev.startsAt),
      startTime: isoToLocalTime(ev.startsAt),
      duration:  Math.round((new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()) / 60000),
      format:    ev.format,
      location:  ev.location  ?? "",
      notes:     ev.notes     ?? "",
    });
  }, []);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!form || !form.date || !form.startTime) return;
    setSaving(true);
    try {
      const startsAt = localDateToISO(form.date, form.startTime);
      const endsAt   = new Date(new Date(startsAt).getTime() + form.duration * 60000).toISOString();
      const cl       = clients.find((c) => c.id === form.clientId);
      const payload  = {
        clientId:   form.clientId || undefined,
        clientName: cl?.name ?? form.title,
        title:      form.title || (cl ? `Консультация — ${cl.name}` : "Консультация"),
        startsAt,
        endsAt,
        timezone:   "Europe/Chisinau",
        format:     form.format,
        location:   form.location || undefined,
        notes:      form.notes    || undefined,
      };

      if (form.id) {
        await fetch(`/api/calendar-events/${form.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast("Консультация обновлена");
      } else {
        await fetch("/api/calendar-events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast("Консультация создана");
      }
      setForm(null);
      await refreshEvents();
    } catch {
      showToast("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  }, [form, clients, refreshEvents, showToast]);

  // Status change
  const handleStatusChange = useCallback(async (ev: CalendarEvent, status: EventStatus) => {
    setSelectedEvent(null);
    await fetch(`/api/calendar-events/${ev.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    showToast("Статус обновлён");
    await refreshEvents();
  }, [refreshEvents, showToast]);

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    setDeleteTarget(null);
    setSelectedEvent(null);
    await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
    showToast("Консультация удалена");
    await refreshEvents();
  }, [refreshEvents, showToast]);

  // Navigation
  const goToday = () => setCurrent(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const goPrev  = () => setCurrent((c) => navigate(view, c, -1));
  const goNext  = () => setCurrent((c) => navigate(view, c, +1));

  const onDayClick = useCallback((day: Date) => {
    if (view === "month") { setCurrent(day); setView("day"); }
  }, [view]);

  // Mobile: compute mini calendar for current month
  const mobileMonthStart = startOfMonth(current);
  const mobileCalStart   = startOfWeek(mobileMonthStart);
  const mobileDays       = Array.from({ length: 35 }, (_, i) => addDays(mobileCalStart, i));

  // Days that have events (set of date keys)
  const daysWithEvents = useMemo(() => {
    const s = new Set<string>();
    events.forEach((ev) => s.add(isoToLocalDate(ev.startsAt)));
    return s;
  }, [events]);

  // Upcoming events: next 5 from today
  const upcomingEvents = useMemo(() => {
    const todayKey = dateKey(today);
    return [...events]
      .filter((ev) => isoToLocalDate(ev.startsAt) >= todayKey)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5);
  }, [events, today]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

    {/* ── MOBILE LAYOUT ── */}
    <div className="lg:hidden flex-1 overflow-y-auto" style={{ background: "#FBF8F5" }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: "#FBF8F5", borderBottom: "1px solid #CFC0A9", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#3D3228" }}>Календарь</span>
        <button
          onClick={() => openCreate()}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "#3a5ff8", color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={13} /> Новая
        </button>
      </div>

      <div style={{ padding: "12px 16px", paddingBottom: 80 }}>
        {/* Mini month calendar */}
        <div style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={goPrev} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B5D4F", padding: 4 }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#3D3228" }}>
              {MONTH_NAMES[current.getMonth()]} {current.getFullYear()}
            </span>
            <button onClick={goNext} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B5D4F", padding: 4 }}>
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEK_DAYS_SHORT.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#A8997F", padding: "2px 0" }}>{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
            {mobileDays.map((day) => {
              const key     = dateKey(day);
              const isToday = isSameDay(day, today);
              const inMonth = day.getMonth() === current.getMonth();
              const hasEvt  = daysWithEvents.has(key);
              return (
                <div
                  key={key}
                  onClick={() => { setCurrent(day); setView("day"); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3px 0", cursor: "pointer", opacity: inMonth ? 1 : 0.35 }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: isToday ? 800 : 500,
                    background: isToday ? "#3a5ff8" : "transparent",
                    color: isToday ? "#fff" : "#3D3228",
                  }}>
                    {day.getDate()}
                  </span>
                  {hasEvt && inMonth && (
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: isToday ? "#fff" : "#3a5ff8", marginTop: 1 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming sessions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#A8997F", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Ближайшие сессии</div>
        {upcomingEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#A8997F", fontSize: 13 }}>
            Нет предстоящих сессий
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcomingEvents.map((ev) => {
              const initials = ev.clientName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", width: "100%" }}
                >
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#A8997F", textTransform: "uppercase" }}>
                      {new Date(ev.startsAt).toLocaleDateString("ru-RU", { month: "short" })}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#3D3228", lineHeight: 1 }}>
                      {new Date(ev.startsAt).getDate()}
                    </span>
                  </div>
                  <div style={{ width: 1, background: "#CFC0A9", alignSelf: "stretch" }} />
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#6B5D4F", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {initials || ev.clientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#3D3228", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.clientName || ev.title}</div>
                    <div style={{ fontSize: 12, color: "#A8997F", marginTop: 2 }}>{fmtTime(ev.startsAt)}–{fmtTime(ev.endsAt)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* ── DESKTOP LAYOUT ── */}
    <div className="hidden lg:flex flex-col h-full overflow-hidden" style={{ background: "#F7F3EA" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] flex-shrink-0" style={{ background: "#EDE7DA" }}>
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <button onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            Сегодня
          </button>
          <button onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Date label */}
        <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
          {rangeLabel(view, current)}
        </h1>

        {/* Loading indicator */}
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}

        {/* View switcher */}
        <div className="hidden sm:flex rounded-xl border border-gray-200 overflow-hidden">
          {VIEW_OPTS.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setView(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${view === value ? "bg-[#4F46E5] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* New event */}
        <button onClick={() => openCreate()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] transition-colors">
          <Plus size={15} /> <span className="hidden sm:inline">Новая</span>
        </button>

        {/* Close */}
        <button onClick={handleClose}
          title="Закрыть"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </header>

      {/* ── View area ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === "month" && (
          <MonthView
            events={events}
            current={current}
            today={today}
            onEventClick={setSelectedEvent}
            onDayClick={onDayClick}
          />
        )}
        {view === "week" && (
          <WeekView
            events={events}
            current={current}
            today={today}
            onEventClick={setSelectedEvent}
            onSlotClick={(day, h) => openCreate(day, h)}
          />
        )}
        {view === "day" && (
          <DayView
            events={events}
            current={current}
            today={today}
            onEventClick={setSelectedEvent}
            onSlotClick={(day, h) => openCreate(day, h)}
          />
        )}
        {view === "list" && (
          <ListView events={events} onEventClick={setSelectedEvent} />
        )}
      </main>

    </div>{/* end hidden lg:flex */}

    {/* ── Modals (shared mobile + desktop, fixed positioning) ── */}
    {selectedEvent && (
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={() => openEdit(selectedEvent)}
        onDelete={() => setDeleteTarget(selectedEvent.id)}
        onStatusChange={(s) => handleStatusChange(selectedEvent, s)}
      />
    )}

    {form && (
      <EventFormModal
        form={form}
        clients={clients}
        saving={saving}
        onClose={() => setForm(null)}
        onSave={handleSave}
        onChange={(patch) => setForm((f) => f ? { ...f, ...patch } : null)}
      />
    )}

    {deleteTarget && (
      <DeleteConfirm
        onConfirm={() => handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    )}

    {toast && <Toast msg={toast} />}
    </div>
  );
}
