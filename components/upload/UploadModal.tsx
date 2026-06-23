"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clients } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import {
  X, Mic, FileAudio, Upload, ChevronRight, Plus,
  CheckCircle2, Loader2, UserPlus, FileText, AlertCircle,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "select_client" | "upload" | "processing" | "done" | "error";

// Processing stages — driven by real API calls, not timers
const STAGES = [
  { icon: "🎙", label: "Загружается файл" },
  { icon: "💾", label: "Создаётся запись" },
  { icon: "✅", label: "Готово" },
];

const ACCEPTED = ".mp3,.m4a,.wav,.ogg,.webm";

export function UploadModal({ open, onClose }: Props) {
  const router = useRouter();

  const [step, setStep]                  = useState<Step>("select_client");
  const [selectedClientId, setSelected] = useState<string | null>(null);
  const [creatingNew, setCreatingNew]   = useState(false);
  const [newName, setNewName]           = useState("");
  const [title, setTitle]               = useState("");
  const [file, setFile]                 = useState<File | null>(null);
  const [dragging, setDragging]         = useState(false);
  const [stageIdx, setStageIdx]         = useState(0);
  const [errorMsg, setErrorMsg]         = useState("");
  const [createdId, setCreatedId]       = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("select_client");
        setSelected(null);
        setCreatingNew(false);
        setNewName("");
        setTitle("");
        setFile(null);
        setDragging(false);
        setStageIdx(0);
        setErrorMsg("");
        setCreatedId(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-redirect after done
  useEffect(() => {
    if (step !== "done" || !createdId) return;
    const t = setTimeout(() => {
      onClose();
      router.push(`/consultation/${createdId}`);
    }, 1400);
    return () => clearTimeout(t);
  }, [step, createdId, onClose, router]);

  const handleFile = useCallback((f: File) => setFile(f), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const clientLabel = creatingNew
    ? newName.trim() || "Новый клиент"
    : selectedClient?.name ?? "";

  const initials = creatingNew
    ? newName.trim().slice(0, 2).toUpperCase() || "НК"
    : selectedClient?.initials ?? "КЛ";

  const color = selectedClient?.color ?? "#6088ff";

  const canProceedToUpload =
    (!!selectedClientId && !creatingNew) ||
    (creatingNew && !!newName.trim());

  // ── Real processing ───────────────────────────────────────────────────────
  async function startProcessing() {
    if (!file) return;
    setStep("processing");
    setErrorMsg("");

    try {
      // Stage 0: upload file
      setStageIdx(0);
      const form = new FormData();
      form.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Ошибка загрузки файла");
      }
      const uploadData = await uploadRes.json();

      // Stage 1: create consultation record
      setStageIdx(1);
      const consultRes = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId:       selectedClientId ?? "",
          clientName:     clientLabel,
          clientInitials: initials,
          clientColor:    color,
          title:          title.trim() || file.name,
          fileName:       uploadData.fileName,
          fileUrl:        uploadData.fileUrl,
          fileSize:       uploadData.fileSize,
          uploadedAt:     uploadData.uploadedAt,
        }),
      });
      if (!consultRes.ok) throw new Error("Ошибка создания записи консультации");
      const { id } = await consultRes.json();

      // Stage 2: done
      setStageIdx(2);
      setCreatedId(id);

      // Small pause so user sees "Готово" before redirect
      setTimeout(() => setStep("done"), 700);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setErrorMsg(message);
      setStep("error");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={step === "processing" ? undefined : onClose}
      />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">

        {/* ── STEP 1: select client ──────────────────────────── */}
        {step === "select_client" && (
          <>
            <ModalHeader title="Новая консультация" onClose={onClose}>
              <p className="text-xs text-slate-400 mt-0.5">Выберите клиента или создайте нового</p>
            </ModalHeader>

            <div className="px-5 py-4 space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
              {clients.map((c) => (
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
                disabled={!canProceedToUpload}
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                Далее <ChevronRight size={14} />
              </button>
            </ModalFooter>
          </>
        )}

        {/* ── STEP 2: title + upload ─────────────────────────── */}
        {step === "upload" && (
          <>
            <ModalHeader title="Запись консультации" onClose={onClose}>
              <div className="flex items-center gap-2 mt-1">
                <Avatar initials={initials} color={color} size="sm" />
                <span className="text-xs text-slate-500">{clientLabel}</span>
              </div>
            </ModalHeader>

            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Название консультации
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
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

              {/* Drop zone */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Аудиозапись <span className="text-slate-300 font-normal">MP3, M4A, WAV</span>
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
                    accept={ACCEPTED}
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
              </div>
            </div>

            <ModalFooter>
              <button
                onClick={() => setStep("select_client")}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Назад
              </button>
              <button
                disabled={!file}
                onClick={startProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Mic size={14} />
                Начать загрузку
              </button>
            </ModalFooter>
          </>
        )}

        {/* ── STEP 3: processing ────────────────────────────── */}
        {step === "processing" && (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
              <Mic size={22} className="text-brand-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-0.5">{clientLabel}</p>
            {(title || file?.name) && (
              <p className="text-xs text-slate-400 italic mb-8 truncate px-4">
                {title || file?.name}
              </p>
            )}

            <div className="space-y-2.5 text-left">
              {STAGES.map((stage, i) => {
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
                    <span className="text-lg w-5 text-center flex-shrink-0">
                      {done ? "✅" : stage.icon}
                    </span>
                    <span className={clsx("text-sm flex-1", active ? "font-medium text-slate-700" : "text-slate-500")}>
                      {stage.label}
                    </span>
                    {active && <Loader2 size={14} className="text-brand-400 animate-spin flex-shrink-0" />}
                    {done   && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-300 mt-6">Не закрывайте окно</p>
          </div>
        )}

        {/* ── STEP 4: done ──────────────────────────────────── */}
        {step === "done" && (
          <div className="px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-1">Файл сохранён</p>
            <p className="text-sm text-slate-500 mb-0.5">{clientLabel}</p>
            {(title || file?.name) && (
              <p className="text-xs text-slate-400 italic">{title || file?.name}</p>
            )}
            <p className="text-xs text-slate-300 mt-4">Открываю страницу консультации...</p>
          </div>
        )}

        {/* ── STEP error ────────────────────────────────────── */}
        {step === "error" && (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-2">Что-то пошло не так</p>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setStep("upload")}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
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
