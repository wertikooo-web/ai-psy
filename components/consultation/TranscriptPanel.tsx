"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/mockData";
import { Search, User, Stethoscope, ChevronsLeft, ChevronsRight, Mic } from "lucide-react";
import clsx from "clsx";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  collapsed: boolean;
  onToggle: () => void;
}

export function TranscriptPanel({ segments, collapsed, onToggle }: TranscriptPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = segments.filter((s) =>
    s.text.toLowerCase().includes(query.toLowerCase())
  );

  // ── Collapsed: narrow vertical tab ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-slate-50 border-r border-slate-100">
        <button
          onClick={onToggle}
          title="Развернуть транскрипт"
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 hover:bg-brand-50 transition-colors w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm group-hover:bg-brand-600 transition-colors">
            <ChevronsRight size={15} className="text-white" />
          </div>
          <span
            className="text-xs font-semibold text-brand-500 select-none group-hover:text-brand-600 transition-colors"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Транскрипт
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">

      {/* Panel header — fixed */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Mic size={13} className="text-slate-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Транскрипт</h2>
              <p className="text-xs text-slate-400">Реплики клиента и психолога</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Свернуть"
            className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-brand-100 border border-brand-200 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ChevronsLeft size={15} className="text-brand-500" />
          </button>
        </div>
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

      {/* Segments — scrolls independently */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">Ничего не найдено</p>
        )}
        {filtered.map((seg) => {
          const isTherapist = seg.speaker === "therapist";
          return (
            <div key={seg.id} className="flex gap-2.5">
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
                  isTherapist ? "bg-brand-50 text-slate-700" : "bg-slate-50 text-slate-600"
                )}>
                  {query ? highlightText(seg.text, query) : seg.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — fixed */}
      <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-xs text-slate-500 text-center font-medium">
          {segments.length} реплик
          {filtered.length !== segments.length && ` · найдено ${filtered.length}`}
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
