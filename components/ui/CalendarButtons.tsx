"use client";

import { CalendarPlus, Download } from "lucide-react";

interface Props {
  clientName:  string;
  date:        string;        // ISO string
  duration?:   string;        // e.g. "52 мин"
  topic?:      string;
  session?:    string | number;
  compact?:    boolean;       // icon-only on mobile when true
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toGCalDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + "Z"
  );
}

function parseMins(duration?: string): number {
  if (!duration) return 60;
  const m = duration.match(/(\d+)/);
  return m ? Number(m[1]) : 60;
}

export function CalendarButtons({ clientName, date, duration, topic, session, compact }: Props) {
  const summary = `Консультация${session ? ` #${session}` : ""} · ${clientName}`;
  const details = topic ? `Тема: ${topic}` : "Психологическая консультация";

  // Google Calendar URL — no OAuth, opens browser form directly
  const dtStart = toGCalDate(date);
  const mins    = parseMins(duration);
  const dtEnd   = toGCalDate(new Date(new Date(date).getTime() + mins * 60_000).toISOString());
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(summary)}` +
    `&dates=${dtStart}/${dtEnd}` +
    `&details=${encodeURIComponent(details)}`;

  // ICS download URL
  const icsUrl = `/api/calendar?clientName=${encodeURIComponent(clientName)}` +
    `&date=${encodeURIComponent(date)}` +
    `&duration=${encodeURIComponent(duration ?? "")}` +
    `&topic=${encodeURIComponent(topic ?? "")}` +
    `&session=${encodeURIComponent(String(session ?? ""))}`;

  const btnBase = "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0";
  const btnStyle = { borderColor: "#D8CFBE", color: "#A8997F", background: "#F4F0E8" } as const;

  return (
    <div className="flex items-center gap-1.5">
      {/* Google Calendar — opens in new tab */}
      <a
        href={gcalUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Добавить в Google Calendar"
        className={btnBase}
        style={btnStyle}
        onMouseEnter={e => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#EAE3D5"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#A8997F"; e.currentTarget.style.background = "#F4F0E8"; }}
      >
        <CalendarPlus size={12} />
        <span className={compact ? "hidden sm:inline" : ""}>Google</span>
      </a>

      {/* ICS — Apple Calendar / Outlook */}
      <a
        href={icsUrl}
        download
        title="Скачать .ics (Apple Calendar, Outlook)"
        className={btnBase}
        style={btnStyle}
        onMouseEnter={e => { e.currentTarget.style.color = "#6B5D4F"; e.currentTarget.style.background = "#EAE3D5"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#A8997F"; e.currentTarget.style.background = "#F4F0E8"; }}
      >
        <Download size={12} />
        <span className={compact ? "hidden sm:inline" : ""}>.ics</span>
      </a>
    </div>
  );
}
