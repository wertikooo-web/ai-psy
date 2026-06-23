"use client";

import { useState } from "react";
import { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  ArrowLeft, FileAudio, Calendar, HardDrive, Clock,
  Zap, Search, UserCheck, Layers, HelpCircle, CalendarCheck,
  Play,
} from "lucide-react";
import Link from "next/link";

interface Props {
  consultation: StoredConsultation;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estimateDuration(bytes: number): string {
  const minutes = Math.round(bytes / (128 * 1024 / 8) / 60);
  if (minutes < 1) return "< 1 мин";
  return `~${minutes} мин`;
}

// ── Analysis modes ────────────────────────────────────────────────────────────

type ModeId =
  | "working"
  | "deep"
  | "therapist"
  | "gestalt"
  | "hypothesis"
  | "next_session";

interface AnalysisMode {
  id: ModeId;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const MODES: AnalysisMode[] = [
  {
    id: "working",
    icon: <Zap size={16} />,
    label: "Рабочий анализ",
    desc: "Ключевые темы, гипотезы, динамика — быстро",
  },
  {
    id: "deep",
    icon: <Search size={16} />,
    label: "Глубокий анализ",
    desc: "Паттерны, процессы, подробный разбор",
  },
  {
    id: "therapist",
    icon: <UserCheck size={16} />,
    label: "Работа психолога",
    desc: "Фокус на ваших интервенциях и реакциях",
  },
  {
    id: "gestalt",
    icon: <Layers size={16} />,
    label: "Гештальт-анализ",
    desc: "Через призму гештальт-подхода",
  },
  {
    id: "hypothesis",
    icon: <HelpCircle size={16} />,
    label: "Проверка гипотезы",
    desc: "Тестирование конкретной гипотезы",
  },
  {
    id: "next_session",
    icon: <CalendarCheck size={16} />,
    label: "Следующая встреча",
    desc: "Что важно учесть на следующей сессии",
  },
];

const MODE_HINTS: Record<ModeId, string> = {
  working:      "Сжатый разбор: основные темы, гипотезы и динамика. Подходит для большинства консультаций.",
  deep:         "Подробный анализ паттернов и терапевтических процессов. Хорошо для ключевых сессий.",
  therapist:    "Взгляд на ваши вопросы, интервенции и реакции. Полезно для супервизии.",
  gestalt:      "Контакт, прерывания, цикл опыта — через призму гештальт-подхода.",
  hypothesis:   "Задайте гипотезу — AI проверит её по транскрипту и оценит уверенность.",
  next_session: "Незавершённые темы, на что обратить внимание, рекомендации к следующей сессии.",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RealConsultationView({ consultation: c }: Props) {
  const [selectedMode, setSelectedMode] = useState<ModeId>("working");
  const [launched, setLaunched]         = useState(false);

  const clientHref = c.clientId ? `/client/${c.clientId}` : "/";

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href={clientHref}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={15} />
          {c.clientName || "Назад"}
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{c.clientName}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">
                Ожидает анализа
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{c.title}</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex-shrink-0">
          {new Date(c.uploadedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-10 pb-16 space-y-4">

          {/* File card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                <FileAudio size={22} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-slate-800 mb-0.5 truncate">{c.title}</h2>
                <p className="text-sm text-slate-400 truncate">{c.fileName}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MetaCell icon={<HardDrive size={13} />} label="Размер"      value={formatBytes(c.fileSize)} />
              <MetaCell icon={<Clock size={13} />}     label="Длительность" value={estimateDuration(c.fileSize)} />
              <MetaCell icon={<Calendar size={13} />}  label="Загружено"   value={
                new Date(c.uploadedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
              } />
            </div>
          </div>

          {/* Analysis mode selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Выберите режим анализа
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {MODES.map((mode) => {
                const active = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-all ${
                      active
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={active ? "text-brand-500" : "text-slate-400"}>
                      {mode.icon}
                    </span>
                    <span className={`text-sm font-medium ${active ? "text-brand-700" : "text-slate-700"}`}>
                      {mode.label}
                    </span>
                    <span className="text-xs text-slate-400 leading-snug">{mode.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected mode hint */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="font-medium text-slate-700">{MODES.find((m) => m.id === selectedMode)?.label}</span>
                {" — "}
                {MODE_HINTS[selectedMode]}
              </p>
            </div>

            {!launched ? (
              <button
                onClick={() => setLaunched(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <Play size={14} />
                Запустить анализ
              </button>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-700">Транскрипция скоро будет доступна</p>
                <p className="text-xs text-amber-500 mt-0.5">
                  Режим выбран: <strong>{MODES.find((m) => m.id === selectedMode)?.label}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Audio player */}
          {c.fileUrl && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-medium text-slate-500 mb-3">Прослушать запись</p>
              <audio
                controls
                src={c.fileUrl}
                className="w-full h-10"
                style={{ accentColor: "#3a5ff8" }}
              >
                Ваш браузер не поддерживает аудиоплеер.
              </audio>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-slate-50 text-center">
      <span className="text-slate-400 mb-1">{icon}</span>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
