"use client";

import { useState, useRef, useEffect } from "react";
import {
  X, Mic, Square, Loader2, CheckCircle2, ChevronDown, PenLine, User,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface Client { id: string; name: string; }

interface Props {
  onClose:          () => void;
  defaultClientId?: string;
}

type Phase   = "idle" | "recording" | "stopped" | "saving" | "transcribing" | "done";
type NoteTab = "audio" | "text";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const C = {
  bg:     "#FDFCFA",
  bdr:    "#E5DDD2",
  head:   "#F0EBE3",
  title:  "#3A2E22",
  muted:  "#A8997F",
  warm:   "#F0EBE1",
  warmBdr:"#D8CFBE",
  dark:   "#6B5D4F",
  darker: "#4A3C2E",
};

const SEL_STYLE: React.CSSProperties = {
  background: "#FFFFFF", borderColor: C.warmBdr, color: C.title,
  borderRadius: "0.75rem", border: `1px solid ${C.warmBdr}`,
  padding: "0.6rem 2rem 0.6rem 0.75rem", fontSize: "0.875rem",
  width: "100%", outline: "none", appearance: "none",
};

export function ObservationModal({ onClose, defaultClientId }: Props) {
  const [tab,       setTab]       = useState<NoteTab>("audio");
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [elapsed,   setElapsed]   = useState(0);
  const [blob,      setBlob]      = useState<Blob | null>(null);
  const [textNote,  setTextNote]  = useState("");
  const [savedText, setSavedText] = useState("");
  const [error,     setError]     = useState("");

  const [clients,       setClients]       = useState<Client[]>([]);
  const [selClientId,   setSelClientId]   = useState(defaultClientId ?? "");
  const [selClientName, setSelClientName] = useState("");

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/clients");
        const list: Client[] = res.ok ? await res.json() : [];
        setClients(list);
        if (defaultClientId) {
          const found = list.find((c) => c.id === defaultClientId);
          if (found) setSelClientName(found.name);
        }
      } catch { /* ignore */ }
    }
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [defaultClientId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleClientChange(id: string) {
    setSelClientId(id);
    setSelClientName(clients.find((c) => c.id === id)?.name ?? "");
  }

  const canSave = !!selClientId;

  // ── Audio recording ─────────────────────────────────────────────────────────
  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        setPhase("stopped");
      };
      mr.start(200);
      mediaRef.current = mr;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } catch {
      setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  }

  async function saveVoiceObservation(withTranscription: boolean) {
    if (!blob || !selClientId) return;
    setPhase("saving");
    setError("");

    // 1) Upload audio as voice_note
    const id   = crypto.randomUUID();
    const form = new FormData();
    form.append("audio",       blob, `voice-${id}.webm`);
    form.append("id",          id);
    form.append("durationSec", String(elapsed));
    form.append("clientId",    selClientId);
    form.append("clientName",  selClientName);

    const vRes = await fetch("/api/voice-notes", { method: "POST", body: form });
    if (!vRes.ok) { setError("Ошибка сохранения аудио"); setPhase("stopped"); return; }
    const vData = await vRes.json();

    // ── Путь A: без транскрипции — сохраняем сразу с финальным текстом ──────
    if (!withTranscription) {
      const matRes = await fetch(`/api/client-materials/${selClientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:    "observation",
          title:   "Голосовое наблюдение",
          content: "Голосовое наблюдение",
        }),
      });
      if (matRes.ok) {
        const matData = await matRes.json();
        window.dispatchEvent(new CustomEvent("observation-created", {
          detail: { clientId: selClientId, observation: { ...matData, status: "done" } },
        }));
      } else {
        setError("Ошибка сохранения наблюдения");
        setPhase("stopped");
        return;
      }
      window.dispatchEvent(new CustomEvent("client-materials-changed", { detail: { clientId: selClientId } }));
      setSavedText("Голосовое наблюдение");
      setPhase("done");
      return;
    }

    // ── Путь B: с транскрипцией — placeholder "Расшифровывается..." ─────────
    const nowIso      = new Date().toISOString();
    const phRes = await fetch(`/api/client-materials/${selClientId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        type:    "observation",
        title:   "Голосовое наблюдение",
        content: "Расшифровывается...",   // non-empty → Supabase NOT NULL ок
      }),
    });
    const phData   = phRes.ok ? await phRes.json() : null;
    const materialId = phData?.id as string | undefined;

    if (materialId) {
      window.dispatchEvent(new CustomEvent("observation-created", {
        detail: {
          clientId: selClientId,
          observation: { ...phData, status: "transcribing", createdAt: phData.createdAt ?? nowIso },
        },
      }));
    }

    // Транскрибируем
    setPhase("transcribing");
    let text = "";
    let transcribeError = false;
    try {
      const tRes  = await fetch("/api/voice-notes/transcribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, audioPath: vData.audioPath ?? `/uploads/voice-${id}.webm` }),
      });
      const tData = await tRes.json();
      text = tData.text ?? "";
    } catch {
      transcribeError = true;
    }

    const finalContent = text || (transcribeError
      ? "Транскрипция не удалась. Аудио сохранено."
      : "Голосовое наблюдение");

    // PATCH placeholder → финальный текст
    if (materialId) {
      const patchRes = await fetch(`/api/client-materials/${selClientId}/${materialId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: finalContent }),
      });
      const patchData = patchRes.ok ? await patchRes.json() : null;
      window.dispatchEvent(new CustomEvent("observation-updated", {
        detail: {
          clientId: selClientId,
          tempId:   materialId,
          observation: {
            ...(patchData ?? phData),
            content: finalContent,
            status:  transcribeError ? "error" : "done",
          },
        },
      }));
    } else {
      // placeholder не создался — создаём напрямую с готовым текстом
      const fallbackRes = await fetch(`/api/client-materials/${selClientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "observation", title: "Голосовое наблюдение", content: finalContent }),
      });
      if (fallbackRes.ok) {
        const fb = await fallbackRes.json();
        window.dispatchEvent(new CustomEvent("observation-created", {
          detail: { clientId: selClientId, observation: { ...fb, status: transcribeError ? "error" : "done" } },
        }));
      }
    }

    window.dispatchEvent(new CustomEvent("client-materials-changed", { detail: { clientId: selClientId } }));
    setSavedText(text || "Голосовое наблюдение");
    setPhase("done");
  }

  async function saveTextObservation() {
    const content = textNote.trim();
    if (!content || !selClientId) return;
    setPhase("saving");
    setError("");
    try {
      await fetch(`/api/client-materials/${selClientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "observation", title: "Наблюдение", content }),
      });
      setSavedText(content);
      setPhase("done");
      window.dispatchEvent(new CustomEvent("client-materials-changed", { detail: { clientId: selClientId } }));
    } catch {
      setError("Ошибка сохранения");
      setPhase("idle");
    }
  }

  const isDone    = phase === "done";
  const isWorking = phase === "saving" || phase === "transcribing";

  // ── Client picker ─────────────────────────────────────────────────────────────
  const ClientPicker = (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        Клиент <span className="text-rose-400">*</span>
      </p>
      <div className="relative">
        <select
          value={selClientId}
          onChange={(e) => handleClientChange(e.target.value)}
          style={SEL_STYLE}
        >
          <option value="">— Выберите клиента —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: C.muted }}
        />
      </div>
      {selClientId && (
        <p className="text-xs pl-1" style={{ color: C.muted }}>
          <User size={10} className="inline mr-1" />
          <strong>{selClientName}</strong> — наблюдение попадёт в карточку клиента и в контекст AI
        </p>
      )}
      {!selClientId && (
        <p className="text-xs pl-1" style={{ color: "#C9BBAA" }}>Выберите клиента чтобы продолжить</p>
      )}
    </div>
  );

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          style={{ background: C.bg, border: `1px solid ${C.bdr}` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{ background: C.head, borderColor: C.bdr }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: C.bdr }}
              >
                {tab === "text"
                  ? <PenLine size={14} style={{ color: C.dark }} />
                  : <Mic size={14} style={{ color: C.dark }} />}
              </div>
              <span className="text-sm font-semibold" style={{ color: C.title }}>
                Новое наблюдение
              </span>
            </div>
            <button onClick={onClose} style={{ color: C.muted }}>
              <X size={16} />
            </button>
          </div>

          {/* Tab switcher */}
          {!isDone && !isWorking && (
            <div className="flex border-b" style={{ borderColor: C.bdr }}>
              {(["audio", "text"] as NoteTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setPhase("idle"); setError(""); }}
                  className="flex-1 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color:        tab === t ? C.title : C.muted,
                    borderBottom: tab === t ? `2px solid ${C.dark}` : "2px solid transparent",
                    background:   "transparent",
                  }}
                >
                  {t === "audio" ? "🎙 Голосовое" : "✏️ Текстовое"}
                </button>
              ))}
            </div>
          )}

          <div className="px-6 py-5 space-y-5">

            {/* ══ AUDIO TAB ══ */}
            {tab === "audio" && !isDone && (
              <>
                {/* Client picker shown always in audio tab */}
                {ClientPicker}

                <div className="flex flex-col items-center gap-3 py-1">
                  {phase === "idle" && (
                    <>
                      <button
                        onClick={startRecording}
                        disabled={!canSave}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: canSave ? C.dark : "#C9BBAA" }}
                      >
                        <Mic size={26} color="white" />
                      </button>
                      <span className="text-xs" style={{ color: C.muted }}>
                        {canSave ? "Нажмите, чтобы начать запись" : "Сначала выберите клиента"}
                      </span>
                    </>
                  )}

                  {phase === "recording" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-2xl font-mono font-semibold" style={{ color: C.title }}>
                          {fmt(elapsed)}
                        </span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="w-14 h-14 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-all"
                        style={{ background: "#C9BBAA" }}
                      >
                        <Square size={20} color={C.title} fill={C.title} />
                      </button>
                      <span className="text-xs" style={{ color: C.muted }}>Нажмите ■ чтобы остановить</span>
                    </>
                  )}

                  {isWorking && (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 size={32} className="animate-spin" style={{ color: C.muted }} />
                      <span className="text-sm" style={{ color: C.muted }}>
                        {phase === "transcribing" ? "Транскрибирую через Whisper..." : "Сохраняю..."}
                      </span>
                    </div>
                  )}

                  {phase === "stopped" && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-semibold" style={{ color: C.title }}>
                        {fmt(elapsed)}
                      </div>
                      <span className="text-xs block mt-0.5" style={{ color: C.muted }}>Запись готова</span>
                    </div>
                  )}
                </div>

                {error && <p className="text-xs text-rose-500">{error}</p>}

                {phase === "stopped" && (
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => saveVoiceObservation(false)}
                      disabled={!canSave}
                      className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ borderColor: C.warmBdr, color: C.dark, background: C.warm }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.warm; }}
                    >
                      Сохранить без текста
                    </button>
                    <button
                      onClick={() => saveVoiceObservation(true)}
                      disabled={!canSave}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                      style={{ background: C.dark, color: "#FFFFFF" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.darker; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.dark; }}
                    >
                      <Mic size={13} />
                      Транскрибировать
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ TEXT TAB ══ */}
            {tab === "text" && !isDone && !isWorking && (
              <>
                {ClientPicker}

                <textarea
                  value={textNote}
                  onChange={(e) => setTextNote(e.target.value)}
                  placeholder="Ваше наблюдение по клиенту..."
                  rows={4}
                  autoFocus={!defaultClientId}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
                  style={{ background: "#FFFFFF", borderColor: C.warmBdr, color: C.title }}
                  onFocus={(e) => { e.target.style.borderColor = C.muted; }}
                  onBlur={(e)  => { e.target.style.borderColor = C.warmBdr; }}
                />

                {error && <p className="text-xs text-rose-500">{error}</p>}

                <button
                  onClick={saveTextObservation}
                  disabled={!textNote.trim() || !canSave}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  style={{ background: C.dark, color: "#FFFFFF" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.darker; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.dark; }}
                >
                  <PenLine size={14} />
                  Сохранить наблюдение
                </button>
              </>
            )}

            {isWorking && tab === "text" && (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 size={32} className="animate-spin" style={{ color: C.muted }} />
                <span className="text-sm" style={{ color: C.muted }}>Сохраняю...</span>
              </div>
            )}

            {/* ══ DONE ══ */}
            {isDone && (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: C.title }}>Наблюдение сохранено</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                    → <strong>{selClientName}</strong> · вкладка «Наблюдения»
                  </p>
                </div>
                {savedText && (
                  <div
                    className="w-full rounded-xl p-3 text-xs leading-relaxed"
                    style={{ background: C.warm, color: C.dark }}
                  >
                    {savedText}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: C.dark, color: "#FFFFFF" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.darker; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = C.dark; }}
                >
                  Готово
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
