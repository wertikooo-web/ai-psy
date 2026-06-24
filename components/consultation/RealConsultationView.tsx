"use client";

import { useState, useEffect } from "react";
import { StoredConsultation, ConsultationStatus } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  ArrowLeft, FileAudio, Calendar, HardDrive, Clock,
  Zap, Search, UserCheck, Layers, Lightbulb, CalendarClock,
  Play, NotebookPen, FileText, Loader2, AlertCircle,
  Download, ChevronDown, ChevronUp, BrainCircuit,
  CheckCircle2, CircleDashed, Trash2,
} from "lucide-react";
import { CalendarButtons } from "@/components/ui/CalendarButtons";
import Link from "next/link";
import { TranscriptPanel } from "./TranscriptPanel";
import { ChatPanel } from "./ChatPanel";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

interface Props {
  consultation: StoredConsultation;
  defaultMode?: ModeId;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function estimateDuration(bytes: number): string {
  const minutes = Math.round(bytes / (128 * 1024 / 8) / 60);
  if (minutes < 1) return "< 1 мин";
  return `~${minutes} мин`;
}

// ── Analysis modes ────────────────────────────────────────────────────────────

type ModeId = "working" | "deep" | "therapist_process" | "gestalt" | "hypothesis" | "next_session";

interface AnalysisMode {
  id: ModeId;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const MODES: AnalysisMode[] = [
  { id: "working",          icon: <Zap size={16} />,         label: "Рабочий анализ",             desc: "Ключевые темы, гипотезы, динамика — быстро" },
  { id: "deep",             icon: <Search size={16} />,      label: "Глубокий анализ",             desc: "Паттерны, процессы, подробный разбор" },
  { id: "hypothesis",       icon: <Lightbulb size={16} />,   label: "Гипотезы",                   desc: "Построить и проверить рабочие гипотезы" },
  { id: "therapist_process",icon: <UserCheck size={16} />,   label: "Работа психолога (+А)",       desc: "Фокус на ваших интервенциях и реакциях" },
  { id: "gestalt",          icon: <Layers size={16} />,      label: "Гештальт-анализ (+G)",        desc: "Через призму гештальт-подхода" },
  { id: "next_session",     icon: <CalendarClock size={16} />,label: "Следующая сессия",           desc: "Что продолжить и исследовать на следующей встрече" },
];

const MODE_HINTS: Record<ModeId, string> = {
  working:          "Сжатый разбор: основные темы, гипотезы и динамика. Подходит для большинства консультаций.",
  deep:             "Подробный анализ паттернов и терапевтических процессов. Хорошо для ключевых сессий.",
  hypothesis:       "Фокус на формировании и проверке рабочих гипотез о клиенте. Полезно когда нужна ясность.",
  therapist_process:"Взгляд на ваши вопросы, интервенции и реакции. Полезно для супервизии.",
  gestalt:          "Контакт, прерывания, цикл опыта — через призму гештальт-подхода.",
  next_session:     "Что важно вынести из этой сессии для следующей: точки продолжения, вопросы, гипотезы.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cleanTitle(title: string, idx = 1): string {
  if (/\.(mp3|m4a|wav|ogg|webm|flac)$/i.test(title)) return `Консультация #${idx}`;
  return title;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RealConsultationView({ consultation: c, defaultMode = "working" }: Props) {
  // ── Derived initial state ─────────────────────────────────────────────────
  const audioFile = c.audio ?? (c.fileUrl
    ? { fileName: c.fileName ?? "", fileUrl: c.fileUrl, fileSize: c.fileSize ?? 0 }
    : null);

  const initialTranscript = c.transcript?.text ?? null;
  const initialStatus     = c.status ?? (audioFile ? "created" : "ready");
  const lastAnalysis      = c.analyses?.length ? c.analyses[c.analyses.length - 1] : null;

  // ── State ─────────────────────────────────────────────────────────────────
  const [currentStatus, setStatus]        = useState<ConsultationStatus>(initialStatus);
  const [transcriptText, setTranscript]   = useState<string | null>(initialTranscript);
  const [transcriptOpen, setTrOpen]       = useState(false);
  const [transcribing, setTranscribing]   = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  const [audioDeleted, setAudioDeleted]   = useState(false);
  const [deletingAudio, setDeletingAudio] = useState(false);

  const [selectedMode, setSelectedMode]   = useState<ModeId>(defaultMode);
  const [analyzing, setAnalyzing]         = useState(false);
  const [analysisResult, setResult]       = useState<string | null>(lastAnalysis?.result ?? null);
  const [analyzedMode, setAnalyzedMode]   = useState<ModeId | null>((lastAnalysis?.mode as ModeId) ?? null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Client context: materials (full objects) + history count
  const [clientMaterials, setClientMaterials] = useState<import("@/lib/types").ClientMaterial[]>([]);
  const [historyCount,    setHistoryCount]    = useState(0);

  useEffect(() => {
    if (!c.clientId) return;
    Promise.all([
      fetch(`/api/client-materials/${c.clientId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/client-history/${c.clientId}`).then(r => r.ok ? r.json() : []),
    ]).then(([mats, hist]) => {
      setClientMaterials(mats as import("@/lib/types").ClientMaterial[]);
      setHistoryCount((hist as unknown[]).length);
    }).catch(() => {});
  }, [c.clientId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function runTranscription() {
    setTranscribing(true);
    setTranscribeErr(null);
    setStatus("transcribing");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId: c.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка транскрипции");
      }
      const { text } = await res.json();
      setTranscript(text);
      setStatus("ready");
    } catch (err) {
      setTranscribeErr(err instanceof Error ? err.message : "Неизвестная ошибка");
      setStatus("created");
    } finally {
      setTranscribing(false);
    }
  }

  async function deleteAudio() {
    if (!confirm("Удалить аудиофайл? Транскрипт сохранится, восстановить аудио будет невозможно.")) return;
    setDeletingAudio(true);
    try {
      const res = await fetch(`/api/consultations/${c.id}/audio`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка");
      setAudioDeleted(true);
    } catch {
      alert("Не удалось удалить аудио");
    } finally {
      setDeletingAudio(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId: c.id, mode: selectedMode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка анализа");
      }
      const data = await res.json();
      setResult(data.result);
      setAnalyzedMode(selectedMode);
      setStatus("done");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Derived display values ────────────────────────────────────────────────
  const source    = c.source ?? (audioFile ? "audio" : "transcript");
  const dateStr   = c.createdAt ?? c.uploadedAt ?? "";
  const hasAudio       = !!audioFile;
  const hasText        = !!(transcriptText ?? c.notes);
  const hasResult      = !!analysisResult;
  const isNotesOnly    = source === "notes" && !c.transcript?.text;
  const hasWhisper     = !!c.transcript?.text;
  const notesText      = c.notes ?? null;
  const whisperText    = c.transcript?.text ?? null;
  const [panelCollapsed, setPanelCollapsed] = useState({ transcript: false, chat: false });

  const clientHref  = c.clientId ? `/client/${c.clientId}` : "/";
  const displayTitle = cleanTitle(c.title);
  const sourceLabel  = source === "audio" ? "Аудиозапись" : source === "notes" ? "Заметки" : "Транскрипт";

  const headerBadgeCls =
    currentStatus === "done"        ? "bg-brand-50 text-brand-500 border-brand-100" :
    currentStatus === "ready"       ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
    currentStatus === "transcribing"? "bg-sky-50 text-sky-600 border-sky-100" :
    currentStatus === "analyzing"   ? "bg-violet-50 text-violet-600 border-violet-100" :
    "bg-amber-50 text-amber-600 border-amber-100";

  const headerBadgeText =
    currentStatus === "done"        ? "Проанализировано" :
    currentStatus === "ready"       ? "Готово к анализу" :
    currentStatus === "transcribing"? "Транскрипция..." :
    currentStatus === "analyzing"   ? "Анализ..." :
    "Ожидает транскрипции";

  // ── 3-panel view after analysis ─────────────────────────────────────────────
  if (hasResult) {
    const segments: import("@/lib/mockData").TranscriptSegment[] = [];
    const fakeChat: import("@/lib/mockData").ChatMessage[] = [];
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
          <Link href={clientHref} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={15} />{c.clientName || "Назад"}
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{c.clientName}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-brand-50 text-brand-500 border-brand-100">
                  Проанализировано
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{cleanTitle(c.title)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {clientMaterials.filter(m => m.type !== "therapist_notes").length > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-lg border" style={{ background: "#F0FDF4", borderColor: "#BBF7D0", color: "#166534" }}>
                📎 {clientMaterials.filter(m => m.type !== "therapist_notes").length} материала включены
              </span>
            )}
            <button
              onClick={() => { setResult(null); setAnalyzedMode(null); setStatus("ready"); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 whitespace-nowrap"
            >
              Обновить анализ
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex overflow-hidden divide-x divide-slate-100">
          <TranscriptPanel
            segments={segments}
            plainText={whisperText ?? undefined}
            notesText={notesText ?? undefined}
            isNotes={isNotesOnly}
            materials={clientMaterials}
            collapsed={panelCollapsed.transcript}
            onToggle={() => setPanelCollapsed(p => ({ ...p, transcript: !p.transcript }))}
          />

          {/* Analysis panel */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
            <div className="px-5 py-4 border-b border-indigo-600 flex-shrink-0 bg-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <BrainCircuit size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">AI-анализ</h2>
                  <p className="text-xs text-indigo-200">{analyzedMode ? MODES.find(m => m.id === analyzedMode)?.label : "Результат анализа"}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              <MarkdownRenderer content={analysisResult ?? ""} />
            </div>
          </div>

          <ChatPanel
            messages={fakeChat}
            collapsed={panelCollapsed.chat}
            onToggle={() => setPanelCollapsed(p => ({ ...p, chat: !p.chat }))}
            consultationId={c.id}
            transcriptText={transcriptText ?? undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
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
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${headerBadgeCls}`}>
                {headerBadgeText}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{displayTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {dateStr && (
            <span className="text-xs text-slate-400">
              {new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </span>
          )}
          <CalendarButtons
            clientName={c.clientName ?? ""}
            date={dateStr}
            topic={c.title ?? ""}
            compact
          />
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-8 pb-16 space-y-4">

          {/* Info card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
            <h2 className="text-base font-semibold text-slate-800 mb-1">{displayTitle}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {dateStr ? new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—"}
              </span>
              <span>·</span>
              <span>{sourceLabel}</span>
              {audioFile && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <HardDrive size={12} />
                    {formatBytes(audioFile.fileSize)}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {estimateDuration(audioFile.fileSize)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Materials block ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Материалы консультации
              </p>
            </div>

            {/* Row 1: Audio */}
            {hasAudio && !audioDeleted && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <FileAudio size={15} className="text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">Аудиозапись</p>
                  <p className="text-xs text-slate-400 truncate">{audioFile!.fileName}</p>
                </div>
                <StatusPill ok={true} label="Загружено" />
                {hasText && (
                  <button
                    onClick={deleteAudio}
                    disabled={deletingAudio}
                    title="Удалить аудио — транскрипт останется"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-50 border border-red-100 hover:border-red-200 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                    {deletingAudio ? "..." : "Удалить аудио"}
                  </button>
                )}
              </div>
            )}

            {/* Row 2: Transcript */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasText ? "bg-emerald-50" : "bg-slate-50"}`}>
                <FileText size={15} className={hasText ? "text-emerald-500" : "text-slate-300"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">Транскрипт</p>
                <p className="text-xs text-slate-400">
                  {hasText ? `${transcriptText!.length.toLocaleString("ru-RU")} символов` : "Не создан"}
                </p>
              </div>
              <StatusPill ok={hasText} label={hasText ? "Готов" : "Нет"} />
              {hasText ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTrOpen((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      transcriptOpen
                        ? "bg-brand-50 text-brand-600 border-brand-200 hover:bg-brand-100"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {transcriptOpen
                      ? <ChevronUp size={14} className="text-brand-500" />
                      : <ChevronDown size={14} className="text-brand-500" />}
                    {transcriptOpen ? "Скрыть" : "Открыть"}
                  </button>
                  <button
                    onClick={() => downloadBlob(transcriptText!, `транскрипт-${c.id.slice(0,8)}.txt`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors"
                  >
                    <Download size={12} />
                    .txt
                  </button>
                </div>
              ) : source === "audio" ? (
                <button
                  onClick={runTranscription}
                  disabled={transcribing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 transition-colors"
                >
                  {transcribing
                    ? <><Loader2 size={12} className="animate-spin" />Транскрибирую...</>
                    : <><Play size={12} />Создать транскрипт</>
                  }
                </button>
              ) : null}
            </div>

            {/* Row 3: AI Analysis */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasResult ? "bg-brand-50" : "bg-slate-50"}`}>
                <BrainCircuit size={15} className={hasResult ? "text-brand-500" : "text-slate-300"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">AI-анализ</p>
                <p className="text-xs text-slate-400">
                  {hasResult ? (analyzedMode ? MODES.find(m => m.id === analyzedMode)?.label ?? analyzedMode : "Готов") : "Не создан"}
                </p>
              </div>
              <StatusPill ok={hasResult} label={hasResult ? "Готов" : "Нет"} />
              {hasResult && analysisResult && (
                <button
                  onClick={() => downloadBlob(analysisResult, `анализ-${c.id.slice(0,8)}.md`, "text/markdown;charset=utf-8")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-50 border border-slate-200 transition-colors"
                >
                  <Download size={12} />
                  .md
                </button>
              )}
            </div>
          </div>

          {/* Transcription error */}
          {transcribeErr && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-600 leading-relaxed">{transcribeErr}</p>
            </div>
          )}

          {/* Audio player */}
          {audioFile?.fileUrl && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-slate-500 mb-3">Прослушать запись</p>
              <audio controls src={audioFile.fileUrl} className="w-full h-10" style={{ accentColor: "#3a5ff8" }}>
                Ваш браузер не поддерживает аудиоплеер.
              </audio>
            </div>
          )}

          {/* Transcript text (collapsible) */}
          {hasText && transcriptOpen && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {source === "notes" ? "Заметки" : "Транскрипт"}
                </p>
                <button
                  onClick={() => setTrOpen(false)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
                >
                  <ChevronUp size={14} className="text-brand-500" />
                  Свернуть
                </button>
              </div>
              <div className="px-5 py-4 max-h-72 overflow-y-auto">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                  {transcriptText}
                </p>
              </div>
            </div>
          )}

          {/* ── Transcript upgraded banner ──────────────────────────────── */}
          {hasWhisper && notesText && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <FileText size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Транскрипт обновлён</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Аудио расшифровано — анализ будет по полному транскрипту. Заметки психолога сохранены во вкладке «Заметки».
                </p>
              </div>
            </div>
          )}

          {/* ── Mode selector (only when transcript available) ────────────── */}
          {hasText && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Режим анализа
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {MODES.map((mode) => {
                  const active = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all ${
                        active ? "border-brand-300 bg-brand-50" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className={active ? "text-brand-500" : "text-slate-400"}>{mode.icon}</span>
                      <span className={`text-xs font-semibold leading-snug ${active ? "text-brand-700" : "text-slate-700"}`}>{mode.label}</span>
                      <span className="text-xs text-slate-400 leading-snug">{mode.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">{MODES.find((m) => m.id === selectedMode)?.label}</span>
                  {" — "}
                  {MODE_HINTS[selectedMode]}
                </p>
              </div>

              {/* Вариант Б — баннер с материалами и кнопка */}
              {(clientMaterials.length > 0 || historyCount > 0) && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#BBF7D0" }}>
                  <div className="px-4 py-3" style={{ background: "#F0FDF4" }}>
                    <p className="text-xs font-semibold text-emerald-700 mb-2">В анализ войдёт:</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <span className="text-emerald-500">✓</span> Транскрипт / заметки консультации
                      </div>
                      {historyCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-emerald-700">
                          <span className="text-emerald-500">✓</span> История клиента ({historyCount} записей)
                        </div>
                      )}
                      {clientMaterials.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs text-emerald-700">
                          <span className="text-emerald-500">✓</span>
                          <span className="font-medium">{m.title || m.type}</span>
                          <span className="text-emerald-500 opacity-60">— материал</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {analyzing ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-600 font-medium">
                  <Loader2 size={14} className="animate-spin" />
                  Анализирую...
                </div>
              ) : (
                <button
                  onClick={runAnalysis}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <Play size={14} />
                  Запустить анализ
                </button>
              )}

              {analysisError && (
                <div className="mt-3 flex items-start gap-2 px-3.5 py-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600 leading-relaxed">{analysisError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Analysis result ───────────────────────────────────────────── */}
          {analysisResult && analyzedMode && (
            <AnalysisResultCard
              text={analysisResult}
              mode={analyzedMode}
              onExport={() => downloadBlob(analysisResult, `анализ-${c.id.slice(0,8)}.md`, "text/markdown;charset=utf-8")}
            />
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
      ok ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
         : "bg-slate-50 text-slate-400 border border-slate-100"
    }`}>
      {ok
        ? <CheckCircle2 size={11} />
        : <CircleDashed size={11} />}
      {label}
    </span>
  );
}

function AnalysisResultCard({
  text,
  mode,
  onExport,
}: {
  text: string;
  mode: ModeId;
  onExport: () => void;
}) {
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      <div className="px-6 py-3.5 border-b border-brand-50 bg-brand-50/60 flex items-center gap-2">
        <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
          Результат анализа
        </span>
        <span className="px-2 py-0.5 rounded-full bg-white border border-brand-100 text-brand-500 text-xs font-medium">
          {modeLabel}
        </span>
        <button
          onClick={onExport}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-brand-500 hover:bg-white border border-brand-100 transition-colors"
        >
          <Download size={12} />
          .md
        </button>
      </div>
      <div className="px-6 py-5">
        <MarkdownRenderer content={text} />
      </div>
    </div>
  );
}
