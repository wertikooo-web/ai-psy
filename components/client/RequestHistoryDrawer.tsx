"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ExternalLink, FileText, BrainCircuit, MessageSquare, Mic, NotebookPen, CheckCircle2, CircleDashed, ChevronDown, ChevronUp, PlusCircle, Link2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { ClientRequest } from "@/lib/types";
import Link from "next/link";

const S = {
  bg:     "#FBF8F2",
  border: "#D8CFBE",
  title:  "#3A2E22",
  muted:  "#9C8E80",
  header: "#E9DCC7",
};

const MODE_LABELS: Record<string, string> = {
  working:          "Рабочий",
  deep:             "Глубокий",
  hypothesis:       "Гипотезы",
  therapist_process:"+A",
  gestalt:          "+G",
  next_session:     "Следующая",
};

interface ConsultationSummary {
  id:            string;
  title:         string;
  createdAt:     string;
  source:        string;
  status:        string;
  analysesCount: number;
  analysesModes: string[];
  hasNotes:      boolean;
  hasTranscript: boolean;
  chatCount:     number;
  sessionNumber: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function cleanTitle(t: string, idx: number) {
  if (/\.(mp3|m4a|wav|ogg|webm|flac)$/i.test(t)) return `Консультация #${idx}`;
  return t || `Консультация #${idx}`;
}

// ── Single consultation row ────────────────────────────────────────────────────

function ConsultationRow({ c }: { c: ConsultationSummary }) {
  const [expanded, setExpanded] = useState(false);

  const hasTranscript = c.hasTranscript || c.hasNotes;
  const SourceIcon = c.source === "audio"
    ? Mic
    : c.source === "notes"
    ? NotebookPen
    : FileText;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: S.border, background: S.bg }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Session number */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: S.header, color: S.title }}
        >
          {c.sessionNumber}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: S.title }}>
            {cleanTitle(c.title, c.sessionNumber)}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: S.muted }}>{fmtDate(c.createdAt)}</span>
            <SourceIcon size={11} style={{ color: S.muted }} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/consultation/${c.id}`}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ background: "#6B5D4F", color: "#FFFFFF" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
          >
            Открыть <ExternalLink size={11} />
          </Link>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "#EDE8DE", color: S.muted }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        {/* Transcript */}
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
          hasTranscript
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : "bg-stone-50 text-stone-400 border-stone-100"
        }`}>
          {hasTranscript ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
          {c.source === "notes" ? "Заметки" : "Транскрипт"}
        </span>

        {/* Analyses */}
        {c.analysesCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-brand-50 text-brand-600 border-brand-100">
            <BrainCircuit size={10} />
            {c.analysesModes.map(m => MODE_LABELS[m] ?? m).join(" · ")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-stone-50 text-stone-400 border-stone-100">
            <CircleDashed size={10} />
            Без анализа
          </span>
        )}

        {/* Chat */}
        {c.chatCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-100">
            <MessageSquare size={10} />
            Чат: {c.chatCount} сообщ.
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t pt-3" style={{ borderColor: S.border }}>
          <p className="text-xs font-medium mb-2" style={{ color: S.muted }}>Детали</p>
          <div className="space-y-1 text-xs" style={{ color: "#6B5D4F" }}>
            <div className="flex items-center gap-2">
              <SourceIcon size={12} />
              <span>{c.source === "audio" ? "Аудиозапись" : c.source === "notes" ? "Текстовые заметки" : "Транскрипт"}</span>
            </div>
            {c.analysesModes.length > 0 && (
              <div className="flex items-center gap-2">
                <BrainCircuit size={12} />
                <span>Анализы: {c.analysesModes.map(m => MODE_LABELS[m] ?? m).join(", ")}</span>
              </div>
            )}
            {c.chatCount > 0 && (
              <div className="flex items-center gap-2">
                <MessageSquare size={12} />
                <span>{c.chatCount} сообщений в чате</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unlinked consultation picker ───────────────────────────────────────────────

interface UnlinkedItem {
  id:        string;
  title:     string;
  createdAt: string;
  source:    string;
}

function AttachPicker({
  clientId,
  requestId,
  linkedIds,
  onAttached,
}: {
  clientId:  string;
  requestId: string;
  linkedIds: Set<string>;
  onAttached: (id: string) => void;
}) {
  const [items, setItems]       = useState<UnlinkedItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/consultations")
      .then(r => r.ok ? r.json() : [])
      .then((all: (UnlinkedItem & { clientId?: string; requestId?: string })[]) => {
        setItems(
          all.filter(c => c.clientId === clientId && !c.requestId && !linkedIds.has(c.id))
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [clientId, requestId]);

  async function attach(consultationId: string) {
    setAttaching(consultationId);
    try {
      const res = await fetch(`/api/consultations/${consultationId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error();
      onAttached(consultationId);
      setItems(prev => prev.filter(c => c.id !== consultationId));
    } catch {
      // silent — user can retry
    } finally {
      setAttaching(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-400 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: S.muted }}>
        Все консультации уже привязаны к запросам.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(c => {
        const SourceIcon = c.source === "audio" ? Mic : c.source === "notes" ? NotebookPen : FileText;
        return (
          <div
            key={c.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
            style={{ borderColor: S.border, background: S.bg }}
          >
            <SourceIcon size={13} style={{ color: S.muted, flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: S.title }}>
                {/\.(mp3|m4a|wav|ogg|webm|flac)$/i.test(c.title) ? "Консультация" : c.title}
              </p>
              <p className="text-xs" style={{ color: S.muted }}>{fmtDate(c.createdAt)}</p>
            </div>
            <button
              onClick={() => attach(c.id)}
              disabled={attaching === c.id}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
              style={{ background: "#6B5D4F", color: "#FFFFFF", opacity: attaching === c.id ? 0.6 : 1 }}
              onMouseEnter={e => { if (attaching !== c.id) e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              <Link2 size={11} />
              Привязать
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────

interface Props {
  request: ClientRequest | null;
  onClose: () => void;
}

export function RequestHistoryDrawer({ request, onClose }: Props) {
  const [consultations, setConsultations] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [pickerOpen, setPickerOpen]       = useState(false);

  const reload = useCallback((requestId: string) => {
    setLoading(true);
    setError("");
    fetch(`/api/request-consultations/${requestId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ConsultationSummary[]) => setConsultations(data))
      .catch(() => setError("Не удалось загрузить историю"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!request) { setConsultations([]); setPickerOpen(false); return; }
    setConsultations([]);
    setPickerOpen(false);
    reload(request.id);
  }, [request?.id, reload]);

  useEffect(() => {
    if (!request) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [request, onClose]);

  if (!request) return null;

  const totalAnalyses = consultations.reduce((s, c) => s + c.analysesCount, 0);
  const totalChats    = consultations.reduce((s, c) => s + c.chatCount, 0);

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — slides in from the right */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col shadow-2xl"
        style={{
          width: "min(520px, 95vw)",
          background: "#FEFCF8",
          borderLeft: `1px solid ${S.border}`,
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-start justify-between px-5 py-4 border-b"
          style={{ background: S.header, borderColor: S.border }}
        >
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>
              История по запросу
            </p>
            <p className="text-sm font-semibold leading-snug" style={{ color: S.title }}>
              {request.text}
            </p>
            {request.comment && (
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                {request.comment}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(0,0,0,0.06)", color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div
            className="flex-shrink-0 flex items-center gap-5 px-5 py-3 border-b text-xs"
            style={{ borderColor: S.border, color: S.muted }}
          >
            <span>Консультаций: <strong style={{ color: S.title }}>{consultations.length}</strong></span>
            <span>Анализов: <strong style={{ color: S.title }}>{totalAnalyses}</strong></span>
            <span>Сообщений: <strong style={{ color: S.title }}>{totalChats}</strong></span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-stone-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="py-10 text-center text-sm" style={{ color: "#B45309" }}>
              {error}
            </div>
          )}

          {!loading && !error && consultations.length === 0 && (
            <div className="py-14 text-center">
              <p className="text-sm" style={{ color: S.muted }}>
                По этому запросу пока нет консультаций.
              </p>
              <p className="text-xs mt-1.5" style={{ color: "#C9BBAA" }}>
                Новые консультации автоматически привязываются к текущему запросу.
              </p>
            </div>
          )}

          {!loading && !error && consultations.map(c => (
            <ConsultationRow key={c.id} c={c} />
          ))}
        </div>

        {/* Footer: attach unlinked consultations */}
        <div
          className="flex-shrink-0 border-t"
          style={{ borderColor: S.border }}
        >
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium transition-colors"
            style={{ color: pickerOpen ? S.title : S.muted }}
            onMouseEnter={e => { e.currentTarget.style.color = S.title; }}
            onMouseLeave={e => { e.currentTarget.style.color = pickerOpen ? S.title : S.muted; }}
          >
            <PlusCircle size={13} />
            Добавить консультацию из истории
            <ChevronDown
              size={13}
              style={{
                marginLeft: "auto",
                transform:  pickerOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {pickerOpen && (
            <div className="px-5 pb-4">
              <AttachPicker
                clientId={request.clientId}
                requestId={request.id}
                linkedIds={new Set(consultations.map(c => c.id))}
                onAttached={() => reload(request.id)}
              />
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
