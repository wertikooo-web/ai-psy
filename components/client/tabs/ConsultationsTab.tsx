"use client";

import { useState } from "react";
import { ArrowRight, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trash2, CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";
import type { StoredConsultation } from "@/lib/consultationStore";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

interface MockSession {
  id: string;
  sessionNumber: number;
  topic: string;
  date: string;
  duration?: string;
  status: string;
  compareData?: {
    prevSession: number;
    newTopics: string[];
    strengthened: string[];
    weakened: string[];
    requestChange: string;
  };
}

const sessionStatus: Record<string, { label: string; cls: string }> = {
  done:        { label: "Проанализирована",       cls: "bg-brand-50 text-brand-500" },
  analyzed:    { label: "Проанализирована",       cls: "bg-brand-50 text-brand-500" },
  ready:       { label: "Готово к анализу",       cls: "bg-emerald-50 text-emerald-600" },
  transcribing:{ label: "Транскрипция...",         cls: "bg-slate-50 text-slate-500" },
  analyzing:   { label: "Анализ...",              cls: "bg-slate-50 text-slate-500" },
  created:     { label: "Ожидает транскрипции",   cls: "bg-amber-50 text-amber-600" },
  uploaded:    { label: "Ожидает транскрипции",   cls: "bg-amber-50 text-amber-600" },
  new:         { label: "Ожидает анализа",        cls: "bg-amber-50 text-amber-600" },
  error:       { label: "Ошибка",                 cls: "bg-red-50 text-red-500" },
};

interface Props {
  isMock: boolean;
  mockSessions?: MockSession[];
  realSessions?: StoredConsultation[];
  onUpload: () => void;
  uploadBtnLabel?: string;
  onDeleteSession?: (id: string) => void;
}

export function ConsultationsTab({
  isMock,
  mockSessions = [],
  realSessions = [],
  onUpload,
  uploadBtnLabel = "Загрузить запись",
  onDeleteSession,
}: Props) {
  const [openCompare, setOpenCompare] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Удалить эту запись консультации?")) return;
    setDeletingId(id);
    await onDeleteSession?.(id);
    setDeletingId(null);
  }

  if (isMock) {
    if (mockSessions.length === 0) {
      return <Empty onUpload={onUpload} label={uploadBtnLabel} />;
    }
    return (
      <div className="space-y-3">
        {mockSessions.map((c, idx) => {
          const st     = sessionStatus[c.status] ?? sessionStatus.uploaded;
          const isOpen = openCompare === c.id;
          const hasPrev = idx < mockSessions.length - 1;
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <SessionNumber n={c.sessionNumber} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{c.topic}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(c.date)}{c.duration ? ` · ${c.duration}` : ""}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls} flex-shrink-0`}>
                  {st.label}
                </span>
                <Link href={`/consultation/${c.id}`}
                  className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium flex-shrink-0 transition-colors">
                  Открыть <ArrowRight size={12} />
                </Link>
              </div>
              {hasPrev && c.compareData && (
                <ComparePanel
                  data={c.compareData}
                  open={isOpen}
                  onToggle={() => setOpenCompare(isOpen ? null : c.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // real client
  if (realSessions.length === 0) return <Empty onUpload={onUpload} label={uploadBtnLabel} />;

  return (
    <div className="space-y-3">
      {realSessions.map((c, idx) => {
        const hasAudio    = !!(c.audio?.fileUrl ?? c.fileUrl);
        const hasTranscript = !!c.transcript?.text;
        const hasAnalysis   = !!(c.analyses?.length);
        const displayTitle  = /\.(mp3|m4a|wav|ogg|webm|flac)$/i.test(c.title)
          ? `Консультация #${idx + 1}`
          : c.title;
        return (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <SessionNumber n={idx + 1} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{displayTitle}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.createdAt ?? c.uploadedAt ?? "")}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MiniStatus ok={hasAudio}      label="Аудио" />
                  <MiniStatus ok={hasTranscript} label="Транскрипт" />
                  <MiniStatus ok={hasAnalysis}   label="Анализ" />
                </div>
              </div>
              <Link href={`/consultation/${c.id}`}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium flex-shrink-0 transition-colors">
                Открыть <ArrowRight size={12} />
              </Link>
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                className="p-1.5 text-slate-200 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                title="Удалить запись"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStatus({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ${
      ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
    }`}>
      {ok ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
      {label}
    </span>
  );
}

function SessionNumber({ n }: { n: number }) {
  return (
    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-slate-500">{n}</span>
    </div>
  );
}

function Empty({ onUpload, label }: { onUpload: () => void; label: string }) {
  return (
    <div className="text-center py-10 text-slate-400 text-sm">
      <p>Записей пока нет.</p>
      <button onClick={onUpload} className="mt-3 text-brand-500 hover:text-brand-600 font-medium transition-colors">
        {label} →
      </button>
    </div>
  );
}

function ComparePanel({
  data,
  open,
  onToggle,
}: {
  data: NonNullable<MockSession["compareData"]>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-slate-50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span>Сравнить с сессией {data.prevSession}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 bg-slate-50/50">
          <p className="text-xs text-slate-500 pt-3 leading-relaxed italic">{data.requestChange}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {data.newTopics.length > 0 && (
              <TagGroup label="Новое" color="emerald" icon={<TrendingUp size={10} />} items={data.newTopics}
                itemCls="bg-emerald-50 text-emerald-700 border-emerald-100" />
            )}
            {data.strengthened.length > 0 && (
              <TagGroup label="Усилилось" color="brand" icon={<TrendingUp size={10} />} items={data.strengthened}
                itemCls="bg-brand-50 text-brand-600 border-brand-100" />
            )}
            {data.weakened.length > 0 && (
              <TagGroup label="Ослабло" color="rose" icon={<TrendingDown size={10} />} items={data.weakened}
                itemCls="bg-rose-50 text-rose-600 border-rose-100" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TagGroup({
  label, color, icon, items, itemCls,
}: {
  label: string; color: string; icon: React.ReactNode; items: string[]; itemCls: string;
}) {
  const labelCls: Record<string, string> = {
    emerald: "text-emerald-600",
    brand:   "text-brand-500",
    rose:    "text-rose-500",
  };
  return (
    <div>
      <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${labelCls[color]}`}>
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span key={t} className={`px-2 py-0.5 rounded-full text-xs border ${itemCls}`}>{t}</span>
        ))}
      </div>
    </div>
  );
}
