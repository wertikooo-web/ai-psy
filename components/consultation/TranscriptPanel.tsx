"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/mockData";
import { Search, User, Stethoscope } from "lucide-react";
import clsx from "clsx";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
}

export function TranscriptPanel({ segments }: TranscriptPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = segments.filter((s) =>
    s.text.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Транскрипт</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тексту..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-slate-300"
          />
        </div>
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">Ничего не найдено</p>
        )}
        {filtered.map((seg) => {
          const isTherapist = seg.speaker === "therapist";
          return (
            <div
              key={seg.id}
              className={clsx(
                "flex gap-2.5 group",
                isTherapist ? "flex-row" : "flex-row"
              )}
            >
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                isTherapist ? "bg-brand-100" : "bg-slate-100"
              )}>
                {isTherapist
                  ? <Stethoscope size={11} className="text-brand-500" />
                  : <User size={11} className="text-slate-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx(
                    "text-xs font-semibold",
                    isTherapist ? "text-brand-600" : "text-slate-500"
                  )}>
                    {seg.speakerName}
                  </span>
                  <span className="text-xs text-slate-300">{seg.timestamp}</span>
                </div>
                <p className={clsx(
                  "text-sm leading-relaxed rounded-xl px-3 py-2",
                  isTherapist
                    ? "bg-brand-50 text-slate-700"
                    : "bg-slate-50 text-slate-600"
                )}>
                  {query
                    ? highlightText(seg.text, query)
                    : seg.text
                  }
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">
          {segments.length} реплик · {filtered.length !== segments.length && `найдено ${filtered.length}`}
        </p>
      </div>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-amber-100 text-amber-800 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}
