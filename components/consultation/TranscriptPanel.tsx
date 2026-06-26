"use client";

import { useState, useRef, useEffect } from "react";
import { TranscriptSegment } from "@/lib/mockData";
import type { FormattedSegment } from "@/lib/consultationStore";
import {
  Search, User, Stethoscope, ChevronsLeft, ChevronsRight, Mic,
  NotebookPen, FileText, Paperclip, ChevronDown, ChevronUp, Users,
  Loader2, Play, Pause, MoreHorizontal, Download, Trash2, AlertTriangle,
  Volume2, Clock,
} from "lucide-react";
import clsx from "clsx";
import type { ClientMaterial } from "@/lib/types";
import { MATERIAL_TYPE_LABELS } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDateRu(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function safeBaseName(clientName: string, date: string): string {
  const name = (clientName || "клиент")
    .replace(/[^\w\sа-яёА-ЯЁ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const d = date ? new Date(date).toISOString().slice(0, 10) : "дата";
  return `${name}_${d}_транскрипт`;
}

function buildTxt(
  segments: FormattedSegment[],
  clientName: string,
  date: string,
): string {
  const dateStr = date ? formatDateRu(date) : "";
  const header = [`Клиент: ${clientName}`, dateStr ? `Дата консультации: ${dateStr}` : "", ""].join("\n");
  const body = segments
    .map((s) => {
      const who = s.speaker === "therapist" ? "Психолог" : s.speaker === "client" ? "Клиент" : "Неизвестно";
      const ts = s.start_seconds > 0 ? `[${fmtTime(s.start_seconds)}] ` : "";
      return `${ts}${who}:\n${s.text}`;
    })
    .join("\n\n");
  return header + body;
}

function buildMd(
  segments: FormattedSegment[],
  clientName: string,
  date: string,
): string {
  const dateStr = date ? formatDateRu(date) : "";
  const lines: string[] = [
    "# Транскрипт консультации",
    "",
    `**Клиент:** ${clientName}  `,
    dateStr ? `**Дата:** ${dateStr}` : "",
    "",
  ];
  segments.forEach((s) => {
    const who = s.speaker === "therapist" ? "Психолог" : s.speaker === "client" ? "Клиент" : "Неизвестно";
    const ts = s.start_seconds > 0 ? `${fmtTime(s.start_seconds)} — ` : "";
    lines.push(`## ${ts}${who}`, "", s.text, "");
  });
  return lines.filter((l) => l !== undefined).join("\n");
}

function downloadText(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Audio player ─────────────────────────────────────────────────────────────

function AudioPlayer({
  consultationId,
  audioDeleted,
  seekRef,
}: {
  consultationId: string;
  audioDeleted: boolean;
  seekRef: React.MutableRefObject<((sec: number) => void) | null>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Expose seekTo via ref so parent can trigger it
  useEffect(() => {
    seekRef.current = (sec: number) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = sec;
      el.play().catch(() => {});
      setPlaying(true);
    };
  }, [seekRef]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().catch(() => {}); setPlaying(true); }
  }

  if (audioDeleted) return null;

  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-t"
      style={{ background: "#F0EBE3", borderColor: "#D8CFBE" }}
    >
      <audio
        ref={audioRef}
        src={`/api/consultations/${consultationId}/audio`}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <button
        onClick={toggle}
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: "#6B5D4F", color: "#fff" }}
        title={playing ? "Пауза" : "Воспроизвести"}
      >
        {playing ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "#6B5D4F" }}>
          {fmtTime(current)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={current}
          step={0.5}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = v;
            setCurrent(v);
          }}
          className="flex-1 h-1 cursor-pointer accent-stone-500"
        />
        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "#A8997F" }}>
          {fmtTime(duration)}
        </span>
      </div>
      <Volume2 size={12} style={{ color: "#A8997F", flexShrink: 0 }} />
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

function ConfirmDialog({ title, description, confirmLabel = "Удалить", onConfirm, onCancel, danger = true }: ConfirmDialogProps) {
  return (
    <div className="mx-4 my-3 rounded-xl border p-4 space-y-3" style={{ background: danger ? "#FFF8F5" : "#F5F0E8", borderColor: danger ? "#F8C4B4" : "#D4C9B5" }}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} style={{ color: danger ? "#C75B3A" : "#A8997F", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#3D3228" }}>{title}</p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#6B5D4F" }}>{description}</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: "#D4C9B5", color: "#6B5D4F", background: "#FAF8F5" }}
        >
          Отмена
        </button>
        <button
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
          style={{ background: danger ? "#C75B3A" : "#6B5D4F", color: "#fff", border: "none" }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ── Formatted transcript with timecodes ───────────────────────────────────────

function FormattedTranscript({
  segments,
  audioDeleted,
  onSeek,
}: {
  segments: FormattedSegment[];
  audioDeleted: boolean;
  onSeek: (sec: number) => void;
}) {
  return (
    <div className="space-y-3">
      {segments.map((seg) => {
        const isTherapist = seg.speaker === "therapist";
        const isClient    = seg.speaker === "client";
        const hasTime     = seg.start_seconds > 0;
        return (
          <div key={seg.order_index} className="flex gap-2.5">
            <div className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
              isTherapist ? "bg-brand-100" : isClient ? "bg-amber-100" : "bg-slate-100",
            )}>
              {isTherapist
                ? <Stethoscope size={11} className="text-brand-500" />
                : isClient
                  ? <User size={11} className="text-amber-500" />
                  : <User size={11} className="text-slate-300" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx("text-xs font-semibold",
                  isTherapist ? "text-brand-600" : isClient ? "text-amber-600" : "text-slate-400"
                )}>
                  {isTherapist ? "Психолог" : isClient ? "Клиент" : "Неизвестно"}
                </span>
                {hasTime && (
                  <button
                    onClick={() => !audioDeleted && onSeek(seg.start_seconds)}
                    title={audioDeleted ? "Аудиозапись удалена" : `Перейти к ${fmtTime(seg.start_seconds)}`}
                    className={clsx(
                      "flex items-center gap-1 text-[11px] tabular-nums px-1.5 py-0.5 rounded transition-colors",
                      audioDeleted
                        ? "cursor-default opacity-40"
                        : "hover:bg-stone-100 cursor-pointer",
                    )}
                    style={{ color: "#A8997F" }}
                  >
                    <Clock size={9} />
                    {fmtTime(seg.start_seconds)}
                  </button>
                )}
              </div>
              <p className={clsx(
                "text-sm leading-relaxed rounded-xl px-3 py-2",
                isTherapist ? "bg-brand-50 text-slate-700" : isClient ? "bg-amber-50 text-slate-700" : "bg-slate-50 text-slate-500",
              )}>
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Legacy speaker-split renderer (for old string-based formatted) ─────────────

function SpeakerTranscript({ text }: { text: string }) {
  return (
    <div className="space-y-2.5">
      {text.split("\n").filter(Boolean).map((line, i) => {
        const isTherapist = line.startsWith("П:");
        const isClient    = line.startsWith("К:");
        const body        = line.replace(/^[ПКпк—–-]+:\s*/, "");
        return (
          <div key={i} className={clsx("flex gap-2.5", isTherapist ? "flex-row-reverse" : "flex-row")}>
            <div className={clsx(
              "w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold",
              isTherapist ? "bg-brand-100 text-brand-600" : isClient ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400",
            )}>
              {isTherapist ? "П" : isClient ? "К" : "?"}
            </div>
            <p className={clsx(
              "text-sm leading-relaxed rounded-xl px-3 py-1.5 max-w-[85%]",
              isTherapist ? "bg-brand-50 text-slate-700 rounded-tr-sm" :
              isClient    ? "bg-amber-50 text-slate-700 rounded-tl-sm" :
                            "bg-slate-50 text-slate-500 rounded-tl-sm",
            )}>{body}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Actions dropdown ──────────────────────────────────────────────────────────

type ConfirmAction = "delete-raw" | "delete-formatted" | "delete-audio" | null;

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "transcript" | "notes" | "materials";

interface TranscriptPanelProps {
  consultationId:      string;
  segments:            TranscriptSegment[];
  collapsed:           boolean;
  onToggle:            () => void;
  plainText?:          string;
  notesText?:          string;
  isNotes?:            boolean;
  materials?:          ClientMaterial[];
  // new
  transcriptFormatted?: FormattedSegment[];
  hasTranscriptRaw?:    boolean;
  audioDeletedAt?:      string;
  clientName?:          string;
  consultationDate?:    string;
  onRefresh?:           () => void;
  onFormattedCreated?:  () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────

export function TranscriptPanel({
  consultationId,
  segments,
  collapsed,
  onToggle,
  plainText,
  notesText,
  isNotes,
  materials = [],
  transcriptFormatted,
  hasTranscriptRaw = true,
  audioDeletedAt,
  clientName = "",
  consultationDate = "",
  onRefresh,
  onFormattedCreated,
}: TranscriptPanelProps) {
  const [formatting, setFormatting]     = useState(false);
  const [formatError, setFormatError]   = useState<string | null>(null);
  const [query, setQuery]               = useState("");
  const [expandedMat, setExpandedMat]   = useState<string | null>(null);
  const [actionsOpen, setActionsOpen]   = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]        = useState<string | null>(null);

  const seekRef = useRef<((sec: number) => void) | null>(null);

  const hasFormatted   = (transcriptFormatted?.length ?? 0) > 0;
  const hasBoth        = !!plainText && !!notesText;
  const hasMaterials   = materials.length > 0;
  const audioDeleted   = !!audioDeletedAt;

  const defaultTab: ActiveTab = plainText || hasFormatted ? "transcript" : notesText ? "notes" : "materials";
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);

  const showTranscript = activeTab === "transcript" && (!!plainText || hasFormatted || segments.length > 0);
  const showNotes      = activeTab === "notes"      && !!notesText;
  const showMaterials  = activeTab === "materials";

  const title    = isNotes && !hasBoth ? "Заметки" : "Транскрипт";
  const subtitle = isNotes && !hasBoth ? "Записи психолога о сессии" : "Реплики клиента и психолога";

  const filtered = segments.filter((s) =>
    s.text.toLowerCase().includes(query.toLowerCase())
  );

  // ── Format speakers ─────────────────────────────────────────────────────────
  async function formatSpeakers() {
    setFormatting(true);
    setFormatError(null);
    try {
      const res = await fetch("/api/format-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
      });

      // Railway can return plain-text "upstream error" (502) — parse safely
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const msg = ct.includes("application/json")
          ? ((await res.json().catch(() => ({}))).error ?? "Ошибка форматирования")
          : await res.text().catch(() => "Ошибка сервера");
        throw new Error(
          msg || "Не удалось разделить транскрипт по репликам. Исходный текст сохранён."
        );
      }
      if (!ct.includes("application/json")) {
        throw new Error("Неожиданный ответ от сервера. Исходный текст сохранён.");
      }
      await res.json();
      onFormattedCreated?.();
      onRefresh?.();
    } catch (e) {
      setFormatError(
        e instanceof Error
          ? e.message
          : "Не удалось разделить транскрипт по репликам. Исходный текст сохранён."
      );
    } finally {
      setFormatting(false);
    }
  }

  // ── Delete actions ──────────────────────────────────────────────────────────
  async function execDelete(action: ConfirmAction) {
    if (!action) return;
    setActionLoading(true);
    const routes: Record<string, string> = {
      "delete-raw":       `/api/consultations/${consultationId}/transcript-raw`,
      "delete-formatted": `/api/consultations/${consultationId}/transcript-formatted`,
      "delete-audio":     `/api/consultations/${consultationId}/audio`,
    };
    try {
      const res = await fetch(routes[action], { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка удаления");
      setActionMsg(
        action === "delete-raw"       ? "Исходный текст удалён" :
        action === "delete-formatted" ? "Разобранный транскрипт удалён" :
                                        "Аудиозапись удалена. Транскрипт сохранён."
      );
      setConfirmAction(null);
      onRefresh?.();
    } catch (e) {
      setFormatError(e instanceof Error ? e.message : "Ошибка");
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function doExport(fmt: "txt" | "md") {
    const base = safeBaseName(clientName, consultationDate);
    if (fmt === "txt") {
      if (hasFormatted) {
        downloadText(buildTxt(transcriptFormatted!, clientName, consultationDate), `${base}.txt`);
      } else if (plainText) {
        // Fallback: export raw text
        downloadText(plainText, `${base}_исходный.txt`);
      }
    } else {
      const segs = transcriptFormatted ?? [];
      downloadText(buildMd(segs, clientName, consultationDate), `${base}.md`, "text/markdown;charset=utf-8");
    }
    setActionsOpen(false);
  }

  // ── Confirm dialog config ───────────────────────────────────────────────────
  function confirmConfig(action: ConfirmAction): ConfirmDialogProps & { show: boolean } {
    if (action === "delete-raw") return {
      show: true,
      title: "Удалить исходный сплошной текст?",
      description: hasFormatted
        ? "Разобранная версия по репликам останется. Исходный текст невозможно восстановить."
        : "После удаления текст консультации в системе не останется. Аудиозапись при этом не будет удалена. Это действие нельзя отменить.",
      confirmLabel: "Удалить исходный текст",
      onConfirm: () => execDelete("delete-raw"),
      onCancel: () => setConfirmAction(null),
      danger: !hasFormatted,
    };
    if (action === "delete-formatted") return {
      show: true,
      title: "Удалить разобранный транскрипт?",
      description: hasTranscriptRaw
        ? "Разобранный транскрипт со всеми репликами и таймкодами будет удалён. Исходный сплошной текст останется."
        : "После удаления текст консультации в системе не останется. Аудиозапись при этом не будет удалена.",
      confirmLabel: "Удалить разобранный транскрипт",
      onConfirm: () => execDelete("delete-formatted"),
      onCancel: () => setConfirmAction(null),
      danger: true,
    };
    if (action === "delete-audio") return {
      show: true,
      title: "Удалить аудиозапись?",
      description: "Аудиофайл будет удалён из хранилища. Транскрипт, реплики, таймкоды и AI-анализ останутся. Повторная транскрибация после удаления будет невозможна.",
      confirmLabel: "Удалить аудиозапись",
      onConfirm: () => execDelete("delete-audio"),
      onCancel: () => setConfirmAction(null),
    };
    return { show: false, title: "", description: "", onConfirm: () => {}, onCancel: () => {} };
  }

  // ── Collapsed ─────────────────────────────────────────────────────────────
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

  const cfg = confirmConfig(confirmAction);

  // ── Expanded ────────────────────────────────────────────────────────────────
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
          <div className="flex items-center gap-2">
            {/* Actions button */}
            <div className="relative">
              <button
                onClick={() => setActionsOpen((o) => !o)}
                title="Действия с транскриптом"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: "rgba(255,255,255,0.12)", color: "#E8E3DA", border: "1px solid rgba(255,255,255,0.18)" }}
              >
                <MoreHorizontal size={13} />
                <span className="hidden sm:inline">Действия</span>
              </button>
              {actionsOpen && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl border shadow-xl z-50 py-1 min-w-[220px]"
                  style={{ background: "#FAF8F5", borderColor: "#D8CFBE" }}
                >
                  {/* Export section — show if any transcript exists */}
                  {(hasFormatted || (hasTranscriptRaw && !!plainText)) && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>
                        Экспорт
                      </div>
                      <button
                        onClick={() => doExport("txt")}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-stone-100 transition-colors text-left"
                        style={{ color: "#3D3228" }}
                      >
                        <Download size={12} />
                        {hasFormatted ? "Скачать TXT" : "Скачать исходный текст (TXT)"}
                      </button>
                      {hasFormatted && (
                        <button
                          onClick={() => doExport("md")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-stone-100 transition-colors text-left"
                          style={{ color: "#3D3228" }}
                        >
                          <Download size={12} /> Скачать Markdown
                        </button>
                      )}
                      <div className="h-px mx-3 my-1" style={{ background: "#E8E3DA" }} />
                    </>
                  )}
                  {/* Deletion section — show each action based on what exists */}
                  {(hasTranscriptRaw || hasFormatted || !audioDeleted) && (
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>
                      Удаление
                    </div>
                  )}
                  {hasTranscriptRaw && (
                    <button
                      onClick={() => { setActionsOpen(false); setConfirmAction("delete-raw"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 transition-colors text-left"
                      style={{ color: "#C75B3A" }}
                    >
                      <Trash2 size={12} /> Удалить исходный транскрипт
                    </button>
                  )}
                  {hasFormatted && (
                    <button
                      onClick={() => { setActionsOpen(false); setConfirmAction("delete-formatted"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 transition-colors text-left"
                      style={{ color: "#C75B3A" }}
                    >
                      <Trash2 size={12} /> Удалить разобранный транскрипт
                    </button>
                  )}
                  {!audioDeleted && (
                    <button
                      onClick={() => { setActionsOpen(false); setConfirmAction("delete-audio"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 transition-colors text-left"
                      style={{ color: "#C75B3A" }}
                    >
                      <Trash2 size={12} /> Удалить аудиозапись
                    </button>
                  )}
                </div>
              )}
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
      </div>

      {/* Confirm dialog (renders in panel body) */}
      {cfg.show && (
        <ConfirmDialog
          title={cfg.title}
          description={cfg.description}
          confirmLabel={cfg.confirmLabel}
          onConfirm={cfg.onConfirm}
          onCancel={cfg.onCancel}
          danger={cfg.danger}
        />
      )}

      {/* Action toast */}
      {actionMsg && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#EBF5EB", color: "#3D7A3D", border: "1px solid #B8DEB8" }}>
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* Tabs */}
      {(hasBoth || hasMaterials) && (
        <div className="flex border-b flex-shrink-0 overflow-x-auto" style={{ background: "#F5F0E8", borderColor: "#E0D8CA" }}>
          {(!!plainText || hasFormatted || (!isNotes && segments.length > 0)) && (
            <button
              onClick={() => setActiveTab("transcript")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "transcript" ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Mic size={12} /> Транскрипт
            </button>
          )}
          {!!notesText && (
            <button
              onClick={() => setActiveTab("notes")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "notes" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <NotebookPen size={12} /> Заметки
            </button>
          )}
          {hasMaterials && (
            <button
              onClick={() => setActiveTab("materials")}
              className={clsx("flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === "materials" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Paperclip size={12} /> Материалы ({materials.length})
            </button>
          )}
        </div>
      )}

      {/* Search (for old-style segments) */}
      {showTranscript && segments.length > 0 && !hasFormatted && (
        <div className="px-4 py-2.5 border-b flex-shrink-0" style={{ background: "#F5F0E8", borderColor: "#E0D8CA" }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по тексту..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
              style={{ border: "1px solid #D8CFBE", background: "#FAF8F5" }}
            />
          </div>
        </div>
      )}

      {/* Materials */}
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
                    <span className="text-xs font-semibold" style={{ color: "#4A3C2E" }}>{m.title || MATERIAL_TYPE_LABELS[m.type]}</span>
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

      {/* Notes */}
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

      {/* Transcript content */}
      {showTranscript && (
        <>
          {/* ── Formatted segments (saved to DB) ── */}
          {hasFormatted && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
              {audioDeleted && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#FFF8EE", border: "1px solid #E8D5AA", color: "#7A5420" }}>
                  <AlertTriangle size={11} />
                  Исходная аудиозапись удалена — таймкоды остаются, но не запускают плеер
                </div>
              )}
              <div className="mb-3 flex items-center gap-3 text-xs" style={{ color: "#A8997F" }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-200 inline-block" />Психолог</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-200 inline-block" />Клиент</span>
                {!audioDeleted && <span className="flex items-center gap-1"><Clock size={10} /> нажмите на время для перехода</span>}
              </div>
              <FormattedTranscript
                segments={transcriptFormatted!}
                audioDeleted={audioDeleted}
                onSeek={(sec) => seekRef.current?.(sec)}
              />
              <div className="mt-4 pt-3 border-t text-xs text-center" style={{ borderColor: "#E0D8CA", color: "#A8997F" }}>
                {transcriptFormatted!.length} реплик
              </div>
            </div>
          )}

          {/* ── Plain text (no formatted yet) ── */}
          {!hasFormatted && plainText && segments.length === 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {hasBoth && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                    <FileText size={12} />
                    Транскрипт получен после расшифровки аудио
                  </div>
                </div>
              )}
              <div className="mb-4">
                <button
                  onClick={formatSpeakers}
                  disabled={formatting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{ borderColor: "#CFC0A9", color: "#6B5D4F", background: "#F9F5EE" }}
                >
                  {formatting
                    ? <><Loader2 size={11} className="animate-spin" />Разделяю реплики...</>
                    : <><Users size={11} />Разделить по репликам</>
                  }
                </button>
                {formatError && <p className="text-xs text-red-500 mt-1">{formatError}</p>}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{plainText}</p>
            </div>
          )}

          {/* ── Legacy mock segments ── */}
          {!hasFormatted && segments.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              {filtered.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Ничего не найдено</p>
              )}
              {filtered.map((seg) => {
                const isTherapist = seg.speaker === "therapist";
                return (
                  <div key={seg.id} className="flex gap-2.5">
                    <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      isTherapist ? "bg-brand-100" : "bg-[#EDE7DA]",
                    )}>
                      {isTherapist ? <Stethoscope size={11} className="text-brand-500" /> : <User size={11} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx("text-xs font-semibold", isTherapist ? "text-brand-600" : "text-slate-500")}>
                          {seg.speakerName}
                        </span>
                        <span className="text-xs text-slate-300">{seg.timestamp}</span>
                      </div>
                      <p className={clsx("text-sm leading-relaxed rounded-xl px-3 py-2",
                        isTherapist ? "bg-brand-50 text-slate-700" : "bg-[#F3EDE2] text-slate-600",
                      )}>
                        {query ? highlightText(seg.text, query) : seg.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Audio player */}
      {showTranscript && !audioDeleted && (
        <AudioPlayer
          consultationId={consultationId}
          audioDeleted={audioDeleted}
          seekRef={seekRef}
        />
      )}

      {/* Footer for segments count */}
      {showTranscript && !hasFormatted && segments.length > 0 && (
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
