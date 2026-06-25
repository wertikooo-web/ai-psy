"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/mockData";
import { Search, User, Stethoscope, ChevronsLeft, ChevronsRight, Mic, NotebookPen, FileText, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import type { ClientMaterial } from "@/lib/types";
import { MATERIAL_TYPE_LABELS } from "@/lib/types";

type ActiveTab = "transcript" | "notes" | "materials";

interface TranscriptPanelProps {
  segments:      TranscriptSegment[];
  collapsed:     boolean;
  onToggle:      () => void;
  plainText?:    string;
  notesText?:    string;
  isNotes?:      boolean;
  materials?:    ClientMaterial[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function TranscriptPanel({ segments, collapsed, onToggle, plainText, notesText, isNotes, materials = [] }: TranscriptPanelProps) {
  const [query, setQuery]           = useState("");
  const [expandedMat, setExpandedMat] = useState<string | null>(null);

  const hasBoth      = !!plainText && !!notesText;
  const hasMaterials = materials.length > 0;

  const defaultTab: ActiveTab = plainText ? "transcript" : notesText ? "notes" : "materials";
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);

  const showTranscript = activeTab === "transcript" && (!!plainText || segments.length > 0);
  const showNotes      = activeTab === "notes"      && !!notesText;
  const showMaterials  = activeTab === "materials";

  const title    = isNotes && !hasBoth ? "Заметки" : "Транскрипт";
  const subtitle = isNotes && !hasBoth ? "Записи психолога о сессии" : "Реплики клиента и психолога";

  const filtered = segments.filter((s) =>
    s.text.toLowerCase().includes(query.toLowerCase())
  );

  // ── Collapsed ─────────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-[#FAF8F5] border-r border-[#D8CFBE]">
        <button
          onClick={onToggle}
          title={`Развернуть ${title.toLowerCase()}`}
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 hover:bg-brand-50 transition-colors w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm group-hover:bg-brand-600 transition-colors">
            <ChevronsRight size={15} className="text-white" />
          </div>
          <span
            className="text-xs font-semibold text-brand-500 select-none group-hover:text-brand-600 transition-colors"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {title}
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#FAF8F5]">

      {/* Header */}
      <div className="px-5 flex-shrink-0 flex items-center" style={{ height: 68, background: "#4E5A6E", borderBottom: "1px solid #3D4A5C" }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Mic size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
              <p className="text-xs text-slate-300 leading-tight">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Свернуть"
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ChevronsLeft size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {(hasBoth || hasMaterials) && (
        <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ background: "#F5F0E8", borderColor: "#E0D8CA" }}>
          {/* Transcript tab — show if there's any transcript content */}
          {(!!plainText || (!isNotes && segments.length > 0)) && (
            <button
              onClick={() => setActiveTab("transcript")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "transcript"
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Mic size={12} /> Транскрипт
            </button>
          )}
          {/* Notes tab */}
          {!!notesText && (
            <button
              onClick={() => setActiveTab("notes")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "notes"
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <NotebookPen size={12} /> Заметки
            </button>
          )}
          {/* Materials tab — always shown if any materials */}
          {hasMaterials && (
            <button
              onClick={() => setActiveTab("materials")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "materials"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Paperclip size={12} /> Материалы ({materials.length})
            </button>
          )}
        </div>
      )}

      {/* Search — only for transcript with segments */}
      {showTranscript && segments.length > 0 && (
        <div className="px-4 py-2.5 border-b flex-shrink-0" style={{ background: "#F5F0E8", borderColor: "#E0D8CA" }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по тексту..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
              style={{ border: "1px solid #D8CFBE", background: "#FAF8F5" }}
            />
          </div>
        </div>
      )}

      {/* ── Materials tab ─────────────────────────────────────────────────── */}
      {showMaterials && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          <div className="rounded-xl border px-4 py-3 flex items-start gap-2" style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}>
            <Paperclip size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 leading-relaxed">
              Эти материалы <span className="font-semibold">автоматически включаются</span> в контекст каждого нового анализа
            </p>
          </div>

          {materials.map((m) => {
            const isOpen  = expandedMat === m.id;
            const preview = m.content.slice(0, 200);
            const hasMore = m.content.length > 200;
            return (
              <div key={m.id} className="rounded-xl border overflow-hidden" style={{ background: "#F8F5F0", borderColor: "#E4DDD0" }}>
                <div className="px-4 py-3" style={{ background: "#F0EBE0", borderBottom: "1px solid #E4DDD0" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "#4A3C2E" }}>
                      {m.title || MATERIAL_TYPE_LABELS[m.type]}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E4DDD0", color: "#7A6E63", border: "1px solid #D0C8B8" }}>
                      {MATERIAL_TYPE_LABELS[m.type]}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{formatDate(m.createdAt)}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {isOpen ? m.content : preview}
                    {!isOpen && hasMore && <span className="text-stone-400">…</span>}
                  </p>
                  {hasMore && (
                    <button
                      onClick={() => setExpandedMat(isOpen ? null : m.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
                    >
                      {isOpen ? <><ChevronUp size={11} /> Свернуть</> : <><ChevronDown size={11} /> Показать полностью</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes view */}
      {showNotes && notesText && (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
              <NotebookPen size={12} />
              Заметки консультации — не дословный транскрипт
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{notesText}</p>
        </div>
      )}

      {/* Plain text transcript */}
      {showTranscript && plainText && segments.length === 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {hasBoth && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                <FileText size={12} />
                Транскрипт получен после расшифровки аудио
              </div>
            </div>
          )}
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{plainText}</p>
        </div>
      )}

      {/* Segments */}
      {showTranscript && segments.length > 0 && (
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
                  isTherapist ? "bg-brand-100" : "bg-[#EDE7DA]"
                )}>
                  {isTherapist
                    ? <Stethoscope size={11} className="text-brand-500" />
                    : <User size={11} className="text-slate-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx("text-xs font-semibold", isTherapist ? "text-brand-600" : "text-slate-500")}>
                      {seg.speakerName}
                    </span>
                    <span className="text-xs text-slate-300">{seg.timestamp}</span>
                  </div>
                  <p className={clsx("text-sm leading-relaxed rounded-xl px-3 py-2",
                    isTherapist ? "bg-brand-50 text-slate-700" : "bg-[#F3EDE2] text-slate-600"
                  )}>
                    {query ? highlightText(seg.text, query) : seg.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {showTranscript && segments.length > 0 && (
        <div className="px-5 py-3 border-t flex-shrink-0" style={{ borderColor: "#E0D8CA" }}>
          <p className="text-xs text-slate-500 text-center font-medium">
            {segments.length} реплик
            {filtered.length !== segments.length && ` · найдено ${filtered.length}`}
          </p>
        </div>
      )}
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
