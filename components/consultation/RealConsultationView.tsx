"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { StoredConsultation, ConsultationStatus } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  ArrowLeft, FileAudio, Calendar, HardDrive, Clock,
  Zap, Search, UserCheck, Layers, Lightbulb, CalendarClock,
  Play, NotebookPen, FileText, Loader2, AlertCircle,
  Download, ChevronDown, ChevronUp, BrainCircuit,
  CheckCircle2, CircleDashed, Trash2, Plus, ScanSearch,
} from "lucide-react";
import { CalendarButtons } from "@/components/ui/CalendarButtons";
import { AnalysisBlockRenderer } from "@/components/analysis/AnalysisBlockRenderer";
import Link from "next/link";

// ── Analysis mode definitions ─────────────────────────────────────────────────
type ModeId = "working" | "deep" | "therapist_process" | "gestalt" | "hypothesis" | "next_session";

const ANALYSIS_MODES: Array<{ id: ModeId; label: string; shortLabel: string; desc: string }> = [
  { id: "working",          label: "Рабочий анализ",         shortLabel: "Рабочий",    desc: "Ключевые темы, гипотезы и динамика. Краткий практический разбор." },
  { id: "deep",             label: "Глубокий анализ",        shortLabel: "Глубокий",   desc: "Паттерны, процессы, противоречия и подробный разбор консультации." },
  { id: "hypothesis",       label: "Гипотезы",               shortLabel: "Гипотезы",   desc: "Построить и проверить рабочие психологические гипотезы." },
  { id: "therapist_process",label: "Работа психолога (+A)",  shortLabel: "+A",         desc: "Разбор интервенций, вопросов, реакций и позиции психолога." },
  { id: "gestalt",          label: "Гештальт-анализ (+G)",   shortLabel: "+G",         desc: "Анализ процесса через призму гештальт-подхода." },
  { id: "next_session",     label: "Следующая сессия",       shortLabel: "Следующая",  desc: "Темы, вопросы и направления работы на следующую встречу." },
];

// ── Analysis progress indicator ───────────────────────────────────────────────
function AnalysisProgress({ transcriptLen }: { transcriptLen: number }) {
  const needsChunking = transcriptLen > 30_000;
  const estimatedSec  = needsChunking ? 150 : 25; // 2.5 min vs 25 sec

  const steps = needsChunking
    ? ["Подготавливаю текст для анализа", "Обрабатываю разделы транскрипта", "Формирую анализ"]
    : ["Анализирую транскрипт", "Формирую результат"];

  const [elapsed, setElapsed]     = useState(0);
  const [stepIdx, setStepIdx]     = useState(0);
  const startRef                  = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(s);
      const idx = Math.min(
        Math.floor((s / estimatedSec) * steps.length),
        steps.length - 1,
      );
      setStepIdx(idx);
    }, 500);
    return () => clearInterval(t);
  }, [estimatedSec, steps.length]);

  const progress = Math.min((elapsed / estimatedSec) * 100, 94);
  const remaining = Math.max(estimatedSec - elapsed, 0);
  const fmt = (s: number) => s >= 60 ? `~${Math.ceil(s / 60)} мин` : `~${s} сек`;

  return (
    <div className="w-full rounded-xl border px-4 py-3.5 space-y-2.5"
      style={{ background: "#F0ECFF", borderColor: "#C4B5FD" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700">Анализирую...</span>
        <span className="text-xs text-violet-500">{fmt(remaining)} осталось</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current step */}
      <p className="text-xs text-violet-600">{steps[stepIdx]}...</p>

      {/* Steps dots */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
              i < stepIdx ? "bg-violet-500" : i === stepIdx ? "bg-violet-400 animate-pulse" : "bg-violet-200"
            }`} />
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px transition-colors duration-300 ${i < stepIdx ? "bg-violet-400" : "bg-violet-200"}`} />
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-violet-400">
        {elapsed} сек · {needsChunking ? "длинная запись — используется сжатие" : "короткая запись"}
      </p>
    </div>
  );
}
import { TranscriptPanel } from "./TranscriptPanel";
import { ChatPanel } from "./ChatPanel";

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

// ── Analysis mode icons ───────────────────────────────────────────────────────

const MODE_ICONS: Record<ModeId, React.ReactNode> = {
  working:          <Zap size={16} />,
  deep:             <Search size={16} />,
  hypothesis:       <Lightbulb size={16} />,
  therapist_process:<UserCheck size={16} />,
  gestalt:          <Layers size={16} />,
  next_session:     <CalendarClock size={16} />,
};

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
  const router = useRouter();

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

  const [selectedMode, setSelectedMode]     = useState<ModeId>(defaultMode);
  const [analyses, setAnalyses]             = useState(c.analyses ?? []);
  const [displayedMode, setDisplayedMode]   = useState<ModeId | null>((lastAnalysis?.mode as ModeId) ?? null);
  const [showEvidenceIcons, setShowEvidenceIcons] = useState(true);
  const [generatingMode, setGeneratingMode] = useState<ModeId | null>(null);
  const [addMenuOpen, setAddMenuOpen]       = useState(false);
  const addMenuRef                          = useRef<HTMLDivElement>(null);
  const [analysisError, setAnalysisError]   = useState<string | null>(null);

  // Client context: materials (full objects) + history count
  const [clientMaterials, setClientMaterials] = useState<import("@/lib/types").ClientMaterial[]>([]);
  const [historyCount,    setHistoryCount]    = useState(0);

  // Staleness: true when materials were added/changed after the last analysis
  const lastAnalysisAt = lastAnalysis?.createdAt ? new Date(lastAnalysis.createdAt).getTime() : 0;
  const [analysisStale, setAnalysisStale] = useState(false);

  useEffect(() => {
    if (!c.clientId) return;
    Promise.all([
      fetch(`/api/client-materials/${c.clientId}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/client-history/${c.clientId}`).then(r => r.ok ? r.json() : []),
    ]).then(([mats, hist]) => {
      // therapist_notes are personal — excluded from AI analysis and from this list
      const materials = (mats as import("@/lib/types").ClientMaterial[]).filter(m => m.type !== "therapist_notes");
      setClientMaterials(materials);
      setHistoryCount((hist as unknown[]).length);
      // Mark stale if any material is newer than the last analysis
      if (lastAnalysisAt > 0 && materials.some(m => new Date(m.createdAt).getTime() > lastAnalysisAt)) {
        setAnalysisStale(true);
      }
    }).catch(() => {});
  }, [c.clientId, lastAnalysisAt]);

  // Listen for real-time observations/materials added via FAB while on this page
  useEffect(() => {
    if (!c.clientId) return;
    function onMaterialsChanged(e: CustomEvent) {
      if (e.detail?.clientId === c.clientId) setAnalysisStale(true);
    }
    window.addEventListener("client-materials-changed", onMaterialsChanged as EventListener);
    return () => window.removeEventListener("client-materials-changed", onMaterialsChanged as EventListener);
  }, [c.clientId]);

  // Close "+ АНАЛИЗ" dropdown on outside click or Esc
  useEffect(() => {
    if (!addMenuOpen) return;
    function onOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setAddMenuOpen(false); }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onOutside); document.removeEventListener("keydown", onEsc); };
  }, [addMenuOpen]);

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
      // Mark analysis stale if one already exists
      if (lastAnalysis) setAnalysisStale(true);
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

  async function runAnalysis(mode: ModeId = selectedMode, force = false) {
    if (generatingMode) return; // prevent double-run
    setAddMenuOpen(false);
    setDisplayedMode(mode);
    setAnalysisError(null);

    // If the analysis exists and we're not forcing, just switch view
    const already = analyses.find(a => a.mode === mode);
    if (already && !force) return;

    setGeneratingMode(mode);
    try {
      const res = await fetch("/api/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ consultationId: c.id, mode, force }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка анализа");
      }
      const data = await res.json();
      const newEntry = { id: data.id, mode, result: data.result, blocks: data.blocks, createdAt: new Date().toISOString() };
      setAnalyses(prev => [...prev.filter(a => a.mode !== mode), newEntry]);
      setAnalysisStale(false);
      setStatus("done");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setGeneratingMode(null);
      router.refresh();
    }
  }

  // ── Derived display values ────────────────────────────────────────────────
  const source    = c.source ?? (audioFile ? "audio" : "transcript");
  const dateStr   = c.createdAt ?? c.uploadedAt ?? "";
  const hasAudio       = !!audioFile;
  const hasText        = !!(transcriptText ?? c.notes);
  // Лупа requires actual transcript (audio/whisper/formatted), not just psychologist notes
  // Map: mode → most recent analysis entry
  const analysesByMode = new Map<ModeId, typeof analyses[0]>();
  for (const a of analyses) analysesByMode.set(a.mode as ModeId, a);
  const selectedAnalysis = displayedMode ? (analysesByMode.get(displayedMode) ?? null) : null;
  // Whether the selected analysis has any evidence tooltip icons
  const hasEvidenceIcons = !!selectedAnalysis?.blocks?.some(
    b => b.isInterpretive && Array.isArray(b.evidenceTooltip) && b.evidenceTooltip.length > 0,
  );
  const hasAnyResult = analyses.length > 0;
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
  if (hasAnyResult || generatingMode !== null) {
    const segments: import("@/lib/mockData").TranscriptSegment[] = [];
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#FAF8F5]">
        <header className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0" style={{ background: "#F5F0E8", borderColor: "#D8CFBE" }}>
          <Link href={clientHref} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={15} />{c.clientName || "Назад"}
          </Link>
          <div className="h-5 w-px" style={{ background: "#D8CFBE" }} />
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
        </header>

        <div className="flex-1 min-h-0 flex items-stretch overflow-hidden divide-x divide-[#D8CFBE]">
          <TranscriptPanel
            consultationId={c.id}
            segments={segments}
            plainText={whisperText ?? undefined}
            notesText={notesText ?? undefined}
            isNotes={isNotesOnly}
            materials={clientMaterials}
            transcriptFormatted={c.transcriptFormatted}
            hasTranscriptRaw={!!c.transcript?.text}
            hasWhisperSegments={!!c.transcriptSegments?.length}
            audioDeletedAt={c.audioDeletedAt}
            clientName={c.clientName}
            consultationDate={c.createdAt}
            collapsed={panelCollapsed.transcript}
            onToggle={() => setPanelCollapsed(p => ({ ...p, transcript: !p.transcript }))}
            onRefresh={() => router.refresh()}
            onFormattedCreated={() => setAnalysisStale(true)}
          />

          {/* Analysis panel */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#FAF8F5]">
            {/* Analysis header */}
            <div
              className="px-4 flex-shrink-0 flex items-center gap-2"
              style={{ height: 68, background: "#9C9289", borderBottom: "1px solid #8A8079" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.10)" }}>
                <BrainCircuit size={15} style={{ color: "#D8CFBE" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold leading-tight" style={{ color: "#FDFAF5" }}>AI-анализ</h2>
                <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: "#D8CFBE" }}>
                  {displayedMode
                    ? (ANALYSIS_MODES.find(m => m.id === displayedMode)?.label ?? displayedMode)
                    : "Выберите вид анализа"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Лупа toggle — show/hide evidence icons without affecting analysis text */}
                {selectedAnalysis && (
                  <button
                    onClick={() => setShowEvidenceIcons(v => !v)}
                    title={showEvidenceIcons
                      ? (hasEvidenceIcons ? "Скрыть объяснения" : "Объяснения доступны после обновления анализа")
                      : "Показать объяснения"}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      background: showEvidenceIcons && hasEvidenceIcons
                        ? "rgba(255,255,255,0.22)"
                        : "rgba(255,255,255,0.08)",
                      color: showEvidenceIcons && hasEvidenceIcons ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                      border: showEvidenceIcons && hasEvidenceIcons
                        ? "1.5px solid rgba(255,255,255,0.45)"
                        : "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <ScanSearch size={13} />
                  </button>
                )}
                {/* Download current analysis as .md */}
                {selectedAnalysis && (
                  <button
                    onClick={() => {
                      const modeLabel = ANALYSIS_MODES.find(m => m.id === displayedMode)?.label ?? displayedMode;
                      const header = `# ${modeLabel}\n\n_Консультация: ${c.title}_\n_Клиент: ${c.clientName}_\n\n---\n\n`;
                      downloadBlob(header + selectedAnalysis.result, `анализ-${displayedMode}-${c.id.slice(0,8)}.md`, "text/markdown;charset=utf-8");
                    }}
                    title="Скачать анализ в формате Markdown"
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: "rgba(255,255,255,0.10)", color: "#FFFFFF" }}
                  >
                    <Download size={13} />
                  </button>
                )}
                {/* Refresh current analysis — always visible when analysis exists */}
                {displayedMode && analysesByMode.has(displayedMode) && (
                  <button
                    onClick={() => runAnalysis(displayedMode, true)}
                    disabled={!!generatingMode}
                    title="Повторно выполнить AI-анализ с текущими настройками."
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                    style={{ background: "rgba(255,255,255,0.10)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.30)" }}
                  >
                    Обновить
                  </button>
                )}

                {/* + АНАЛИЗ dropdown */}
                <div className="relative" ref={addMenuRef}>
                  <button
                    onClick={() => setAddMenuOpen(o => !o)}
                    disabled={!!generatingMode || !hasText}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-opacity"
                    style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.40)" }}
                    title={!hasText ? "Сначала создайте транскрипт консультации" : "Создать дополнительный анализ"}
                  >
                    <Plus size={12} /> АНАЛИЗ
                  </button>

                  {addMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 rounded-xl border shadow-xl z-50 py-1 overflow-hidden" style={{ background: "#FAF8F5", borderColor: "#D8CFBE", minWidth: 290 }}>
                      {ANALYSIS_MODES.map(m => {
                        const exists    = analysesByMode.has(m.id);
                        const isGenerat = generatingMode === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => runAnalysis(m.id)}
                            disabled={isGenerat}
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-stone-100 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold" style={{ color: "#3D3228" }}>{m.label}</span>
                                {isGenerat && <Loader2 size={11} className="animate-spin text-violet-500 flex-shrink-0" />}
                                {exists && !isGenerat && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                              </div>
                              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#8A7A6A" }}>{m.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mode tabs — shown when 2+ analyses exist, or a second one is generating */}
            {(analyses.length > 1 || (analyses.length === 1 && generatingMode !== null && generatingMode !== analyses[0]?.mode)) && (
              <div className="flex border-b flex-shrink-0 overflow-x-auto scrollbar-none" style={{ height: 36, background: "#F5F0E8", borderColor: "#D8CFBE" }}>
                {ANALYSIS_MODES
                  .filter(m => analysesByMode.has(m.id) || generatingMode === m.id)
                  .map(m => (
                    <button
                      key={m.id}
                      onClick={() => setDisplayedMode(m.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                        displayedMode === m.id
                          ? "border-stone-600 text-stone-700"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {m.shortLabel}
                      {generatingMode === m.id && <Loader2 size={10} className="animate-spin text-violet-500" />}
                      {analysesByMode.has(m.id) && generatingMode !== m.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                  ))}

              </div>
            )}

            {/* Stale banner */}
            {analysisStale && selectedAnalysis && (
              <div className="flex items-center justify-between gap-3 px-4 py-2 flex-shrink-0 min-w-0 overflow-hidden" style={{ background: "#FEF3DC", borderBottom: "1px solid #E8C97A" }}>
                <p className="text-xs min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "#7A5420" }}>Данные изменились — обновите анализ</p>
                <button
                  onClick={() => displayedMode && runAnalysis(displayedMode, true)}
                  className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap"
                  style={{ background: "#C9A96E", color: "#1A0F05" }}
                >
                  Обновить
                </button>
              </div>
            )}

            {/* Error banner */}
            {analysisError && (
              <div className="flex items-start gap-2 px-4 py-2.5 flex-shrink-0" style={{ background: "#FEF2F2", borderBottom: "1px solid #FCA5A5" }}>
                <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{analysisError}</p>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
              {generatingMode !== null && generatingMode === displayedMode ? (
                <AnalysisProgress transcriptLen={transcriptText?.length ?? 0} />
              ) : selectedAnalysis ? (
                <AnalysisBlockRenderer
                  result={selectedAnalysis.result}
                  blocks={selectedAnalysis.blocks}
                  showLupa={showEvidenceIcons}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <BrainCircuit size={32} style={{ color: "#C9BBAA" }} />
                  <p className="text-sm text-center" style={{ color: "#9C8E80" }}>
                    {generatingMode ? "Создаём анализ..." : "Нажмите «+ АНАЛИЗ» для запуска"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <ChatPanel
            collapsed={panelCollapsed.chat}
            onToggle={() => setPanelCollapsed(p => ({ ...p, chat: !p.chat }))}
            consultationId={c.id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#FAF8F5]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0" style={{ background: "#F5F0E8", borderColor: "#D8CFBE" }}>
        <Link
          href={clientHref}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={15} />
          {c.clientName || "Назад"}
        </Link>

        <div className="h-5 w-px" style={{ background: "#D8CFBE" }} />

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
          <div className="rounded-2xl border shadow-sm px-6 py-5" style={{ background: "#FBF8F2", borderColor: "#D8CFBE" }}>
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
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#FBF8F2", borderColor: "#D8CFBE" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "#E0D8CA", background: "#F5F0E8" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9C8E80" }}>
                Материалы консультации
              </p>
            </div>

            {/* Row 1: Audio */}
            {hasAudio && !audioDeleted && (
              <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "#E0D8CA" }}>
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
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E0D8CA]">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasText ? "bg-emerald-50" : "bg-[#EDE7DA]"}`}>
                <FileText size={15} className={hasText ? "text-emerald-500" : "text-slate-300"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">Транскрипт</p>
                <p className="text-xs text-slate-400">
                  {hasText ? `${(transcriptText ?? c.notes ?? "").length.toLocaleString("ru-RU")} символов` : "Не создан"}
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
                    onClick={() => downloadBlob(transcriptText ?? c.notes ?? "", `транскрипт-${c.id.slice(0,8)}.txt`)}
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
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${hasAnyResult ? "bg-brand-50" : "bg-[#EDE7DA]"}`}>
                <BrainCircuit size={15} className={hasAnyResult ? "text-brand-500" : "text-slate-300"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">AI-анализ</p>
                <p className="text-xs text-slate-400">
                  {hasAnyResult ? `${analyses.length} ${analyses.length === 1 ? "анализ" : "анализов"}` : "Не создан"}
                </p>
              </div>
              <StatusPill ok={hasAnyResult} label={hasAnyResult ? "Готов" : "Нет"} />
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
            <div className="rounded-2xl border shadow-sm px-5 py-4" style={{ background: "#FBF8F2", borderColor: "#D8CFBE" }}>
              <p className="text-xs font-medium text-slate-500 mb-3">Прослушать запись</p>
              <audio controls src={audioFile.fileUrl.startsWith("storage://") ? `/api/consultations/${c.id}/audio` : audioFile.fileUrl} className="w-full h-10" style={{ accentColor: "#3a5ff8" }}>
                Ваш браузер не поддерживает аудиоплеер.
              </audio>
            </div>
          )}

          {/* Transcript text (collapsible) */}
          {hasText && transcriptOpen && (
            <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#FBF8F2", borderColor: "#D8CFBE" }}>
              <div className="px-5 py-3 border-b border-[#E0D8CA] flex items-center justify-between">
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
                  Аудио расшифровано — анализ будет по полному транскрипту.
                </p>
              </div>
            </div>
          )}

          {/* ── Mode selector (only when transcript available) ────────────── */}
          {hasText && (
            <div className="rounded-2xl border shadow-sm p-6" style={{ background: "#FBF8F2", borderColor: "#D8CFBE" }}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Режим анализа
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {ANALYSIS_MODES.map((mode) => {
                  const active = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all ${
                        active ? "border-brand-300 bg-brand-50" : "border-[#D8CFBE] hover:border-[#C9BBAA] hover:bg-[#F0EAE0]"
                      }`}
                    >
                      <span className={active ? "text-brand-500" : "text-slate-400"}>{MODE_ICONS[mode.id]}</span>
                      <span className={`text-xs font-semibold leading-snug ${active ? "text-brand-700" : "text-slate-700"}`}>{mode.label}</span>
                      <span className="text-xs text-slate-400 leading-snug">{mode.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="px-3.5 py-2.5 rounded-xl mb-4" style={{ background: "#F5F0E8", border: "1px solid #E0D8CA" }}>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">{ANALYSIS_MODES.find((m) => m.id === selectedMode)?.label}</span>
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

              <button
                onClick={() => runAnalysis(selectedMode)}
                disabled={!hasText}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <Play size={14} />
                Запустить анализ
              </button>

              {analysisError && (
                <div className="mt-3 flex items-start gap-2 px-3.5 py-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600 leading-relaxed">{analysisError}</p>
                </div>
              )}
            </div>
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

