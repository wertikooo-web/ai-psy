"use client";

import { useState, use } from "react";
import { clients, consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight, Mic, ArrowLeft,
  TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp,
} from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric",
  });
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  active:    { label: "в процессе",  cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  paused:    { label: "пауза",       cls: "bg-amber-50 text-amber-600 border-amber-100" },
  completed: { label: "завершена",   cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

const sessionStatus: Record<string, { label: string; cls: string }> = {
  analyzed:    { label: "Проанализирована", cls: "bg-brand-50 text-brand-500" },
  new:         { label: "Ожидает анализа",  cls: "bg-amber-50 text-amber-600" },
  in_progress: { label: "В обработке",      cls: "bg-slate-50 text-slate-500" },
};

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openCompare, setOpenCompare] = useState<string | null>(null);

  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  const clientConsultations = consultations
    .filter((c) => c.clientId === client.id)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);

  const st = statusLabel[client.status] ?? statusLabel.active;

  return (
    <>
      <div className="p-8 max-w-2xl mx-auto space-y-8">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={14} />
          Главная
        </Link>

        {/* Client header */}
        <div className="flex items-start gap-4">
          <Avatar initials={client.initials} color={client.color} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-800">{client.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                {st.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{client.age} лет · {client.concern}</p>
            <p className="text-xs text-slate-400 mt-1">
              {client.totalConsultations} встреч · последняя {formatDate(client.lastConsultation)}
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors flex-shrink-0"
          >
            <Mic size={13} />
            Новая запись
          </button>
        </div>

        {/* Therapy overview */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">

          {/* Repeating themes */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Повторяющиеся темы терапии
            </p>
            <div className="flex flex-wrap gap-2">
              {client.mainTopics.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full text-sm text-slate-600 bg-slate-50 border border-slate-100"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Last shift */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Последний значимый сдвиг
            </p>
            <p className="text-sm text-slate-600 leading-relaxed italic">{client.lastShift}</p>
          </div>

          {/* Current focus */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Текущий фокус
            </p>
            <p className="text-sm font-medium text-slate-700">{client.currentFocus}</p>
          </div>

          {/* Dynamics from a consultation clientMap */}
          {(() => {
            const map = clientConsultations.find((c) => c.clientMap)?.clientMap;
            if (!map?.dynamics?.length) return null;
            return (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                  Динамика терапии
                </p>
                <div className="flex flex-wrap gap-2">
                  {map.dynamics.map((d) => (
                    <span
                      key={d.label}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${
                        d.direction === "up"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {d.direction === "up"
                        ? <TrendingUp size={12} />
                        : <TrendingDown size={12} />}
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Consultations timeline */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            История консультаций
          </h2>

          {clientConsultations.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Консультации не найдены</p>
          )}

          <div className="space-y-3">
            {clientConsultations.map((c, idx) => {
              const st = sessionStatus[c.status] ?? sessionStatus.new;
              const isOpen = openCompare === c.id;
              const hasPrev = idx < clientConsultations.length - 1;

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {/* Session row */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-500">{c.sessionNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.topic}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(c.date)} · {c.duration}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls} flex-shrink-0`}>
                      {st.label}
                    </span>
                    <Link
                      href={`/consultation/${c.id}`}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium flex-shrink-0 transition-colors"
                    >
                      Открыть
                      <ArrowRight size={12} />
                    </Link>
                  </div>

                  {/* Compare button */}
                  {hasPrev && c.compareData && (
                    <div className="border-t border-slate-50">
                      <button
                        onClick={() => setOpenCompare(isOpen ? null : c.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span>Сравнить с сессией {c.compareData.prevSession}</span>
                        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {/* Compare panel */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 bg-slate-50/50">
                          <p className="text-xs text-slate-500 pt-3 leading-relaxed italic">
                            {c.compareData.requestChange}
                          </p>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {c.compareData.newTopics.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-600 mb-1.5 flex items-center gap-1">
                                  <Minus size={10} className="rotate-90" />
                                  Новое
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {c.compareData.newTopics.map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {c.compareData.strengthened.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-brand-500 mb-1.5 flex items-center gap-1">
                                  <TrendingUp size={10} />
                                  Усилилось
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {c.compareData.strengthened.map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-brand-50 text-brand-600 border border-brand-100">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {c.compareData.weakened.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-rose-500 mb-1.5 flex items-center gap-1">
                                  <TrendingDown size={10} />
                                  Ослабло
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {c.compareData.weakened.map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-600 border border-rose-100">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
