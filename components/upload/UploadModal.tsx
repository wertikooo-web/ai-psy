"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { useRouter } from "next/navigation";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";
import { Avatar } from "@/components/ui/Avatar";
import {
  X, Mic, FileAudio, Upload, ChevronRight, Plus,
  CheckCircle2, Loader2, UserPlus, FileText, AlertCircle, Lock,
  FileUp, NotebookPen,
} from "lucide-react";
import clsx from "clsx";

type SourceType = "audio" | "transcript" | "notes";

interface Props {
  open: boolean;
  onClose: () => void;
  presetClientId?: string;
  presetClientName?: string;
  presetClientInitials?: string;
  presetClientColor?: string;
}

type Step = "select_client" | "select_source" | "input" | "processing" | "done" | "error";

const AUDIO_ACCEPTED = ".mp3,.m4a,.wav,.ogg,.webm";

const SOURCES: Array<{
  id: SourceType;
  icon: React.ReactNode;
  label: string;
  sub: string;
  path: string;
}> = [
  {
    id: "audio",
    icon: <Mic size={18} className="text-brand-500" />,
    label: "Аудиозапись",
    sub: "mp3 · wav · m4a",
    path: "Файл → транскрипция → анализ",
  },
  {
    id: "transcript",
    icon: <FileUp size={18} className="text-emerald-600" />,
    label: "Готовый транскрипт",
    sub: "txt · md · вставить текст",
    path: "Текст → анализ сразу",
  },
  {
    id: "notes",
    icon: <NotebookPen size={18} className="text-amber-600" />,
    label: "Текстовые заметки",
    sub: "свободный текст",
    path: "Заметки → анализ сразу",
  },
];

export function UploadModal({
  open,
  onClose,
  presetClientId,
  presetClientName,
  presetClientInitials,
  presetClientColor,
}: Props) {
  const router    = useRouter();
  const hasPreset = !!presetClientId;

  const initialStep: Step = hasPreset ? "select_source" : "select_client";

  const [step, setStep]                   = useState<Step>(initialStep);
  const [realClients, setRealClients]     = useState<StoredClient[]>([]);
  const [selectedClientId, setSelected]   = useState<string | null>(presetClientId ?? null);
  const [creatingNew, setCreatingNew]     = useState(false);
  const [newName, setNewName]             = useState("");
  const [selectedSource, setSource]       = useState<SourceType | null>(null);
  const [title, setTitle]                 = useState("");
  const [file, setFile]                   = useState<File | null>(null);
  const [dragging, setDragging]           = useState(false);
  const [transcriptText, setTranscript]   = useState("");
  const [stageIdx, setStageIdx]           = useState(0);
  const [errorMsg, setErrorMsg]           = useState("");
  const [createdId, setCreatedId]         = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load real clients on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data: StoredClient[]) => setRealClients(data))
      .catch(() => {});
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(initialStep);
        setSelected(presetClientId ?? null);
        setCreatingNew(false);
        setNewName("");
        setSource(null);
        setTitle("");
        setFile(null);
        setDragging(false);
        setTranscript("");
        setStageIdx(0);
        setErrorMsg("");
        setCreatedId(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, initialStep, presetClientId]);

  // Redirect after done
  useEffect(() => {
    if (step !== "done" || !createdId) return;
    const t = setTimeout(() => {
      onClose();
      router.push(`/consultation/${createdId}`);
    }, 1400);
    return () => clearTimeout(t);
  }, [step, createdId, onClose, router]);

  const handleFile = useCallback((f: File) => setFile(f), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // Merged client list: real clients first, then mock
  const allClients = [
    ...realClients,
    ...mockClients.filter((m) => !realClients.some((r) => r.id === m.id)),
  ];

  // Client display values
  const mockClient  = allClients.find((c) => c.id === selectedClientId);
  const clientLabel = hasPreset
    ? (presetClientName ?? "")
    : creatingNew
    ? (newName.trim() || "Новый клиент")
    : (mockClient?.name ?? "");
  const initials = hasPreset
    ? (presetClientInitials ?? "КЛ")
    : creatingNew
    ? (newName.trim().slice(0, 2).toUpperCase() || "НК")
    : (mockClient?.initials ?? "КЛ");
  const color = hasPreset
    ? (presetClientColor ?? "#6088ff")
    : (mockClient?.color ?? "#6088ff");

  const canProceedToSource =
    hasPreset ||
    (!!selectedClientId && !creatingNew) ||
    (creatingNew && !!newName.trim());

  const canSubmit =
    selectedSource === "audio"
      ? !!file
      : transcriptText.trim().length > 10;

  // ── Processing ──────────────────────────────────────────────────────────────
  async function startProcessing() {
    if (!selectedSource) return;
    setStep("processing");
    setStageIdx(0);
    setErrorMsg("");

    try {
      if (selectedSource === "audio") {
        if (!file) return;

        setStageIdx(0);
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Ошибка загрузки файла");
        }
        const uploadData = await uploadRes.json();

        setStageIdx(1);
        const res = await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId:       selectedClientId ?? "",
            clientName:     clientLabel,
            clientInitials: initials,
            clientColor:    color,
            title:          title.trim() || file.name,
            source:         "audio",
            audio: {
              fileName: uploadData.fileName,
              fileUrl:  uploadData.fileUrl,
              fileSize: uploadData.fileSize,
            },
          }),
        });
        if (!res.ok) throw new Error("Ошибка создания записи");
        const { id } = await res.json();
        setStageIdx(2);
        setCreatedId(id);
        setTimeout(() => setStep("done"), 700);

      } else {
        // transcript or notes — no file upload
        setStageIdx(0);
        const res = await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId:       selectedClientId ?? "",
            clientName:     clientLabel,
            clientInitials: initials,
            clientColor:    color,
            title:          title.trim() || (selectedSource === "notes" ? "Заметки о сессии" : "Транскрипт сессии"),
            source:         selectedSource,
            transcriptText: transcriptText.trim(),
          }),
        });
        if (!res.ok) throw new Error("Ошибка создания записи");
        const { id } = await res.json();
        setStageIdx(1);
        setCreatedId(id);
        setTimeout(() => setStep("done"), 700);
      }

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Неизвестная ошибка");
      setStep("error");
    }
  }

  if (!open) return null;

  const audioStages  = ["Загружается файл", "Создаётся запись", "Готово"];
  const textStages   = ["Сохраняется запись", "Готово"];
  const stages       = selectedSource === "audio" ? audioStages : textStages;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={step === "processing" ? undefined : onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">

        {/* ── STEP: select client ─────────────────────────────── */}
        {step === "select_client" && (
          <>
            <ModalHeader title="Новая консультация" onClose={onClose}>
              <p className="text-xs text-slate-400 mt-0.5">Выберите клиента или создайте нового</p>
            </ModalHeader>

            <div className="px-5 py-4 space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
              {allClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c.id); setCreatingNew(false); }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left",
                    selectedClientId === c.id && !creatingNew
                      ? "border-brand-300 bg-brand-50"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Avatar initials={c.initials} color={c.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.currentFocus}</p>
                  </div>
                  {selectedClientId === c.id && !creatingNew && (
                    <CheckCircle2 size={16} className="text-brand-500 flex-shrink-0" />
                  )}
                </button>
              ))}

              <button
                onClick={() => { setCreatingNew(true); setSelected(null); }}
                className={clsx(
                  "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left",
                  creatingNew
                    ? "border-brand-300 bg-brand-50"
                    : "border-dashed border-slate-200 hover:border-brand-200 hover:bg-brand-50/30"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Plus size={14} className="text-slate-400" />
                </div>
                <span className="text-sm text-slate-500">Новый клиент</span>
              </button>
            </div>

            {creatingNew && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-brand-300 transition-colors">
                  <UserPlus size={14} className="text-slate-400 flex-shrink-0" />
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Имя клиента..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <ModalFooter>
              <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Отмена
              </button>
              <button
                disabled={!canProceedToSource}
                onClick={() => setStep("select_source")}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                Далее <ChevronRight size={14} />
              </button>
            </ModalFooter>
          </>
        )}

        {/* ── STEP: select source ─────────────────────────────── */}
        {step === "select_source" && (
          <>
            <ModalHeader title="Источник материала" onClose={onClose}>
              <ClientChip label={clientLabel} initials={initials} color={color} locked={hasPreset} />
            </ModalHeader>

            <div className="px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Что у вас есть
              </p>
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSource(s.id); setStep("input"); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left"
                >
                  <div className={clsx(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    s.id === "audio"      && "bg-brand-50",
                    s.id === "transcript" && "bg-emerald-50",
                    s.id === "notes"      && "bg-amber-50",
                  )}>
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{s.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{s.path}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0 ml-1" />
                </button>
              ))}
            </div>

            <ModalFooter>
              {hasPreset ? (
                <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Отмена
                </button>
              ) : (
                <button onClick={() => setStep("select_client")} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  ← Назад
                </button>
              )}
              <span className="text-xs text-slate-300">Выберите источник →</span>
            </ModalFooter>
          </>
        )}

        {/* ── STEP: input (varies by source) ──────────────────── */}
        {step === "input" && (
          <>
            <ModalHeader
              title={
                selectedSource === "audio"
                  ? "Аудиозапись"
                  : selectedSource === "transcript"
                  ? "Готовый транскрипт"
                  : "Текстовые заметки"
              }
              onClose={onClose}
            >
              <ClientChip label={clientLabel} initials={initials} color={color} locked={hasPreset} />
            </ModalHeader>

            <div className="px-5 py-4 space-y-4">
              {/* Title field */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Название <span className="text-slate-300 font-normal">(необязательно)</span>
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-brand-300 transition-all">
                  <FileText size={14} className="text-slate-300 flex-shrink-0" />
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например: Тема тревоги и отношений"
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              {/* Audio upload */}
              {selectedSource === "audio" && (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">
                    Аудиофайл <span className="text-slate-300 font-normal">MP3, M4A, WAV</span>
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={clsx(
                      "border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all",
                      dragging
                        ? "border-brand-400 bg-brand-50"
                        : file
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
                    )}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept={AUDIO_ACCEPTED}
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    {file ? (
                      <>
                        <FileAudio size={26} className="text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700 truncate px-4">{file.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
                        <p className="text-xs text-brand-500 mt-1.5">Нажмите, чтобы заменить</p>
                      </>
                    ) : (
                      <>
                        <Upload size={26} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-1">Перетащите файл или нажмите</p>
                        <p className="text-xs text-slate-400">до 500 МБ</p>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    После сохранения потребуется шаг транскрипции
                  </p>
                </div>
              )}

              {/* Transcript text */}
              {selectedSource === "transcript" && (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">
                    Текст транскрипта
                  </label>
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={"Психолог: Как вы себя чувствуете сегодня?\nКлиент: Немного лучше, чем прошлый раз..."}
                    className="w-full h-40 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-brand-300 focus:outline-none text-sm text-slate-700 placeholder:text-slate-300 resize-none font-mono leading-relaxed transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Вставьте текст разговора. AI будет анализировать его как стенограмму.
                  </p>
                </div>
              )}

              {/* Notes text */}
              {selectedSource === "notes" && (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">
                    Заметки о сессии
                  </label>
                  <textarea
                    value={transcriptText}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Клиент поднял тему отношений с матерью. Заметил защитную позицию при разговоре о прошлом. Ресурс — профессиональная реализация..."
                    className="w-full h-40 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-brand-300 focus:outline-none text-sm text-slate-700 placeholder:text-slate-300 resize-none leading-relaxed transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Произвольный текст. AI учтёт, что это заметки, а не стенограмма.
                  </p>
                </div>
              )}
            </div>

            <ModalFooter>
              <button
                onClick={() => setStep("select_source")}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Источник
              </button>
              <button
                disabled={!canSubmit}
                onClick={startProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {selectedSource === "audio" ? <Mic size={14} /> : <CheckCircle2 size={14} />}
                Создать консультацию
              </button>
            </ModalFooter>
          </>
        )}

        {/* ── STEP: processing ────────────────────────────────── */}
        {step === "processing" && (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
              {selectedSource === "audio"
                ? <Mic size={22} className="text-brand-500" />
                : <FileText size={22} className="text-brand-500" />}
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-0.5">{clientLabel}</p>
            {title && (
              <p className="text-xs text-slate-400 italic mb-8 truncate px-4">{title}</p>
            )}

            <div className="space-y-2.5 text-left">
              {stages.map((label, i) => {
                const done    = i < stageIdx;
                const active  = i === stageIdx;
                const pending = i > stageIdx;
                return (
                  <div
                    key={i}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                      active  && "bg-brand-50 border border-brand-100",
                      !active && "bg-slate-50",
                      done    && "opacity-50",
                      pending && "opacity-25"
                    )}
                  >
                    <span className="text-sm flex-1">{label}</span>
                    {active  && <Loader2 size={14} className="text-brand-400 animate-spin flex-shrink-0" />}
                    {done    && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-300 mt-6">Не закрывайте окно</p>
          </div>
        )}

        {/* ── STEP: done ──────────────────────────────────────── */}
        {step === "done" && (
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-1">
              {selectedSource === "audio" ? "Файл сохранён" : "Запись создана"}
            </p>
            <p className="text-sm text-slate-500 mb-0.5">{clientLabel}</p>
            {title && <p className="text-xs text-slate-400 italic">{title}</p>}
            <p className="text-xs text-slate-300 mt-4">Открываю страницу консультации...</p>
          </div>
        )}

        {/* ── STEP: error ──────────────────────────────────────── */}
        {step === "error" && (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-2">Что-то пошло не так</p>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setStep("input")}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}

      </div>
    </div>
    </ModalPortal>
  );
}

function ClientChip({ label, initials, color, locked }: {
  label: string;
  initials: string;
  color: string;
  locked: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <Avatar initials={initials} color={color} size="sm" />
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {locked && <Lock size={10} className="text-slate-300 ml-0.5" />}
    </div>
  );
}

function ModalHeader({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {children}
      </div>
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors ml-3 flex-shrink-0"
      >
        <X size={15} className="text-slate-400" />
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
      {children}
    </div>
  );
}
