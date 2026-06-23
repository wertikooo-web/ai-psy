import { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import { ArrowLeft, FileAudio, Calendar, HardDrive, Clock, Mic } from "lucide-react";
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

// Rough estimate: 1 MB ≈ 1 min for typical mp3 at 128kbps
function estimateDuration(bytes: number): string {
  const minutes = Math.round(bytes / (128 * 1024 / 8) / 60);
  if (minutes < 1) return "< 1 мин";
  return `~${minutes} мин`;
}

const INITIALS_COLOR: Record<string, string> = {};

export function RealConsultationView({ consultation: c }: Props) {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/consultations"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={15} />
          Назад
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{c.clientName}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                Загружено
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{c.title}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-lg space-y-4">

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
              <MetaCell icon={<HardDrive size={13} />} label="Размер" value={formatBytes(c.fileSize)} />
              <MetaCell icon={<Clock size={13} />}     label="Длительность" value={estimateDuration(c.fileSize)} />
              <MetaCell icon={<Calendar size={13} />}  label="Загружено" value={
                new Date(c.uploadedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
              } />
            </div>

            <div className="mt-4 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400">
                Загружено: {formatDate(c.uploadedAt)}
              </p>
            </div>
          </div>

          {/* Status: waiting for transcription */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Mic size={15} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Файл ожидает транскрипции</p>
                <p className="text-xs text-slate-400 mt-0.5">Транскрипция и AI-анализ будут запущены вручную</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { icon: "🎙", label: "Запись загружена", done: true },
                { icon: "📝", label: "Создаётся транскрипт", done: false },
                { icon: "🧠", label: "Выполняется AI-анализ", done: false },
                { icon: "✅", label: "Готово", done: false },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                    s.done ? "bg-emerald-50" : "bg-slate-50 opacity-40"
                  }`}
                >
                  <span className="text-base w-5 text-center flex-shrink-0">{s.icon}</span>
                  <span className={`text-sm ${s.done ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                  {s.done && (
                    <span className="ml-auto text-xs text-emerald-600 font-medium">Готово</span>
                  )}
                </div>
              ))}
            </div>

            <button
              disabled
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
            >
              Запустить транскрипцию — скоро
            </button>
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
