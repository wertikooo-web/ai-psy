"use client";

import { useState, useRef, useEffect } from "react";
import { X, Mic, Square, Loader2, CheckCircle2, ChevronDown, User, FileText, PenLine } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { clients as mockClients, consultations as mockConsultations } from "@/lib/mockData";

interface Client       { id: string; name: string; }
interface Consultation { id: string; clientName: string; title?: string; topic?: string; createdAt: string; }

interface Props {
  onClose: () => void;
  defaultClientId?:        string;
  defaultClientName?:      string;
  defaultConsultationId?:  string;
  defaultConsultationTitle?: string;
}

type Phase    = "idle" | "recording" | "stopped" | "saving" | "transcribing" | "done";
type DestType = "none" | "client" | "consultation";
type NoteTab  = "audio" | "text";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SEL_STYLE: React.CSSProperties = {
  background: "#FFFFFF", borderColor: "#D8CFBE", color: "#3A2E22",
  borderRadius: "0.75rem", border: "1px solid #D8CFBE",
  padding: "0.6rem 2rem 0.6rem 0.75rem", fontSize: "0.875rem",
  width: "100%", outline: "none", appearance: "none" as const,
};

// ── Destination picker — shared between audio and text tabs ───────────────────
function DestPicker({
  destType, setDestType,
  clients, consultations,
  selClient, selClientName, handleClientChange,
  selCons, selConsTitle, handleConsChange,
  destValid,
}: {
  destType: DestType; setDestType: (v: DestType) => void;
  clients: Client[]; consultations: Consultation[];
  selClient: string; selClientName: string; handleClientChange: (id: string) => void;
  selCons: string; selConsTitle: string; handleConsChange: (id: string) => void;
  destValid: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#A8997F" }}>Куда сохранить</p>

      <div className="grid grid-cols-3 gap-2">
        {([
          { id: "none",         label: "Без привязки", icon: <FileText size={13} /> },
          { id: "client",       label: "Клиенту",      icon: <User size={13} /> },
          { id: "consultation", label: "Консультации", icon: <Mic size={13} /> },
        ] as { id: DestType; label: string; icon: React.ReactNode }[]).map(opt => (
          <button
            key={opt.id}
            onClick={() => setDestType(opt.id)}
            className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all"
            style={{
              background:  destType === opt.id ? "#6B5D4F" : "#F0EBE1",
              borderColor: destType === opt.id ? "#6B5D4F" : "#D8CFBE",
              color:       destType === opt.id ? "#FFFFFF"  : "#6B5D4F",
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {destType === "client" && (
        <div className="relative">
          <select value={selClient} onChange={e => handleClientChange(e.target.value)} style={SEL_STYLE}>
            <option value="">— Выберите клиента —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
          {selClient && <p className="text-xs mt-1 pl-1" style={{ color: "#A8997F" }}>✓ <strong>{selClientName}</strong></p>}
        </div>
      )}

      {destType === "consultation" && (
        <div className="relative">
          <select value={selCons} onChange={e => handleConsChange(e.target.value)} style={SEL_STYLE}>
            <option value="">— Выберите консультацию —</option>
            {consultations.map(c => (
              <option key={c.id} value={c.id}>
                {c.clientName} · {c.title || c.topic || new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
          {selCons && <p className="text-xs mt-1 pl-1" style={{ color: "#A8997F" }}>✓ <strong>{selConsTitle}</strong></p>}
        </div>
      )}

      {!destValid && (destType === "client" || destType === "consultation") && (
        <p className="text-xs" style={{ color: "#C9BBAA" }}>
          {destType === "client" ? "Выберите клиента из списка" : "Выберите консультацию из списка"}
        </p>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export function VoiceNoteModal({
  onClose,
  defaultClientId, defaultClientName,
  defaultConsultationId, defaultConsultationTitle,
}: Props) {
  const [tab,      setTab]      = useState<NoteTab>("audio");
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [elapsed,  setElapsed]  = useState(0);
  const [blob,     setBlob]     = useState<Blob | null>(null);
  const [text,     setText]     = useState("");
  const [textNote, setTextNote] = useState("");
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const [destType,      setDestType]      = useState<DestType>(
    defaultConsultationId ? "consultation" : defaultClientId ? "client" : "none"
  );
  const [clients,       setClients]       = useState<Client[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selClient,     setSelClient]     = useState(defaultClientId ?? "");
  const [selClientName, setSelClientName] = useState(defaultClientName ?? "");
  const [selCons,       setSelCons]       = useState(defaultConsultationId ?? "");
  const [selConsTitle,  setSelConsTitle]  = useState(defaultConsultationTitle ?? "");

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res     = await fetch("/api/clients");
        const real: Client[] = res.ok ? await res.json() : [];
        const realIds = new Set(real.map(c => c.id));
        setClients([...real, ...mockClients.filter(m => !realIds.has(m.id)).map(m => ({ id: m.id, name: m.name }))]);
      } catch {
        setClients(mockClients.map(m => ({ id: m.id, name: m.name })));
      }
      try {
        const res  = await fetch("/api/consultations");
        const real: Consultation[] = res.ok ? await res.json() : [];
        const realIds = new Set(real.map(c => c.id));
        const mocks = mockConsultations.filter(m => !realIds.has(m.id)).map(m => ({
          id: m.id, clientName: m.clientName, title: m.topic, topic: m.topic, createdAt: m.date,
        }));
        setConsultations([...real, ...mocks]);
      } catch {
        setConsultations(mockConsultations.map(m => ({
          id: m.id, clientName: m.clientName, title: m.topic, topic: m.topic, createdAt: m.date,
        })));
      }
    }
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleClientChange(id: string) {
    setSelClient(id);
    setSelClientName(clients.find(c => c.id === id)?.name ?? "");
  }
  function handleConsChange(id: string) {
    setSelCons(id);
    const c = consultations.find(c => c.id === id);
    setSelConsTitle(c?.title || c?.topic || `Консультация · ${c?.clientName}`);
  }

  const destValid =
    destType === "none" ||
    (destType === "client" && !!selClient) ||
    (destType === "consultation" && !!selCons);

  const destLabel =
    destType === "consultation" && selConsTitle ? `→ ${selConsTitle}` :
    destType === "client" && selClientName      ? `→ ${selClientName}` :
    "сохранена без привязки";

  // ── Audio recording ──
  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        setPhase("stopped");
      };
      mr.start(200);
      mediaRef.current = mr;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    } catch {
      setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  }

  async function transcribeNote(id: string, audioPath: string) {
    setPhase("transcribing");
    const res  = await fetch("/api/voice-notes/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, audioPath }),
    });
    const data = await res.json();
    if (data.text) setText(data.text);
    else setError("Не удалось транскрибировать. Запись сохранена без текста.");
  }

  async function saveAudio(withTranscription: boolean) {
    if (!blob) return;
    setPhase("saving");
    setError("");
    const id   = crypto.randomUUID();
    const form = new FormData();
    form.append("audio",       blob, `voice-${id}.webm`);
    form.append("id",          id);
    form.append("durationSec", String(elapsed));
    if (destType === "client" && selClient) {
      form.append("clientId",   selClient);
      form.append("clientName", selClientName);
    }
    if (destType === "consultation" && selCons) {
      form.append("consultationId",    selCons);
      form.append("consultationTitle", selConsTitle);
    }
    const res  = await fetch("/api/voice-notes", { method: "POST", body: form });
    if (!res.ok) { setError("Ошибка сохранения"); setPhase("stopped"); return; }
    const data = await res.json();
    // Use the audioPath returned by the server (handles both Supabase storage:// and local /uploads/)
    if (withTranscription) await transcribeNote(id, data.audioPath ?? `/uploads/voice-${id}.webm`);
    setPhase("done");
  }

  // ── Text note save ──
  async function saveText() {
    if (!textNote.trim()) { setError("Введите текст заметки"); return; }
    setSaving(true);
    setError("");
    const id   = crypto.randomUUID();
    const form = new FormData();
    form.append("id",          id);
    form.append("durationSec", "0");
    form.append("text",        textNote.trim());
    if (destType === "client" && selClient) {
      form.append("clientId",   selClient);
      form.append("clientName", selClientName);
    }
    if (destType === "consultation" && selCons) {
      form.append("consultationId",    selCons);
      form.append("consultationTitle", selConsTitle);
    }
    const res = await fetch("/api/voice-notes", { method: "POST", body: form });
    setSaving(false);
    if (!res.ok) { setError("Ошибка сохранения"); return; }
    setText(textNote.trim());
    setPhase("done");
  }

  const isDone     = phase === "done";
  const isWorking  = phase === "saving" || phase === "transcribing";

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
          style={{ background: "#FDFCFA", border: "1px solid #E5DDD2" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ background: "#F0EBE3", borderColor: "#E5DDD2" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#E5DDD2" }}>
                {tab === "text" ? <PenLine size={14} style={{ color: "#6B5D4F" }} /> : <Mic size={14} style={{ color: "#6B5D4F" }} />}
              </div>
              <span className="text-sm font-semibold" style={{ color: "#3A2E22" }}>Новая заметка</span>
            </div>
            <button onClick={onClose} style={{ color: "#A8997F" }}><X size={16} /></button>
          </div>

          {/* Tab switcher — only before done/working */}
          {!isDone && !isWorking && (
            <div className="flex border-b" style={{ borderColor: "#E5DDD2" }}>
              {([
                { id: "audio", label: "🎙 Голосовая" },
                { id: "text",  label: "✏️ Текстовая" },
              ] as { id: NoteTab; label: string }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setPhase("idle"); setError(""); }}
                  className="flex-1 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color:       tab === t.id ? "#3A2E22" : "#A8997F",
                    borderBottom: tab === t.id ? "2px solid #6B5D4F" : "2px solid transparent",
                    background:  "transparent",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-6 py-5 space-y-5">

            {/* ══ AUDIO TAB ══ */}
            {tab === "audio" && (
              <>
                <div className="flex flex-col items-center gap-3 py-1">
                  {phase === "idle" && (
                    <>
                      <button
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105"
                        style={{ background: "#6B5D4F" }}
                      >
                        <Mic size={26} color="white" />
                      </button>
                      <span className="text-xs" style={{ color: "#A8997F" }}>Нажмите, чтобы начать запись</span>
                    </>
                  )}

                  {phase === "recording" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-2xl font-mono font-semibold" style={{ color: "#3D3228" }}>{fmt(elapsed)}</span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="w-14 h-14 rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-all"
                        style={{ background: "#C9BBAA" }}
                      >
                        <Square size={20} color="#3D3228" fill="#3D3228" />
                      </button>
                      <span className="text-xs" style={{ color: "#A8997F" }}>Нажмите ■ чтобы остановить</span>
                    </>
                  )}

                  {isWorking && (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 size={32} className="animate-spin" style={{ color: "#A8997F" }} />
                      <span className="text-sm" style={{ color: "#A8997F" }}>
                        {phase === "transcribing" ? "Транскрибирую через Whisper..." : "Сохраняю..."}
                      </span>
                    </div>
                  )}

                  {phase === "stopped" && (
                    <div className="text-center">
                      <div className="text-2xl font-mono font-semibold" style={{ color: "#3D3228" }}>{fmt(elapsed)}</div>
                      <span className="text-xs block mt-0.5" style={{ color: "#A8997F" }}>Запись готова</span>
                    </div>
                  )}

                  {isDone && (
                    <div className="flex flex-col items-center gap-2 py-1">
                      <CheckCircle2 size={34} className="text-emerald-500" />
                      <span className="text-sm font-medium" style={{ color: "#3D3228" }}>Заметка сохранена</span>
                      <span className="text-xs" style={{ color: "#A8997F" }}>{destLabel}</span>
                      {text && (
                        <div className="mt-1 w-full rounded-xl p-3 text-xs leading-relaxed" style={{ background: "#F0EBE1", color: "#6B5D4F" }}>
                          {text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {phase === "stopped" && (
                  <DestPicker
                    destType={destType} setDestType={setDestType}
                    clients={clients} consultations={consultations}
                    selClient={selClient} selClientName={selClientName} handleClientChange={handleClientChange}
                    selCons={selCons} selConsTitle={selConsTitle} handleConsChange={handleConsChange}
                    destValid={destValid}
                  />
                )}

                {error && <p className="text-xs text-rose-500">{error}</p>}

                {phase === "stopped" && (
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => saveAudio(false)}
                      disabled={!destValid}
                      className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ borderColor: "#D8CFBE", color: "#6B5D4F", background: "#F0EBE1" }}
                      onMouseEnter={e => { if (destValid) e.currentTarget.style.background = "#E8E0D0"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#F0EBE1"; }}
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => saveAudio(true)}
                      disabled={!destValid}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                      style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                      onMouseEnter={e => { if (destValid) e.currentTarget.style.background = "#4A3C2E"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
                    >
                      <Mic size={13} />
                      Транскрибировать
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ TEXT TAB ══ */}
            {tab === "text" && !isDone && (
              <>
                <textarea
                  value={textNote}
                  onChange={e => setTextNote(e.target.value)}
                  placeholder="Напишите заметку..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none focus:outline-none"
                  style={{ background: "#FFFFFF", borderColor: "#D8CFBE", color: "#3A2E22" }}
                  onFocus={e => { e.target.style.borderColor = "#A8997F"; }}
                  onBlur={e  => { e.target.style.borderColor = "#D8CFBE"; }}
                  autoFocus
                />

                <DestPicker
                  destType={destType} setDestType={setDestType}
                  clients={clients} consultations={consultations}
                  selClient={selClient} selClientName={selClientName} handleClientChange={handleClientChange}
                  selCons={selCons} selConsTitle={selConsTitle} handleConsChange={handleConsChange}
                  destValid={destValid}
                />

                {error && <p className="text-xs text-rose-500">{error}</p>}

                <button
                  onClick={saveText}
                  disabled={saving || !textNote.trim() || !destValid}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                  {saving ? "Сохраняю..." : "Сохранить заметку"}
                </button>
              </>
            )}

            {/* Text tab done screen */}
            {tab === "text" && isDone && (
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 size={34} className="text-emerald-500" />
                <span className="text-sm font-medium" style={{ color: "#3D3228" }}>Заметка сохранена</span>
                <span className="text-xs" style={{ color: "#A8997F" }}>{destLabel}</span>
                <div className="mt-1 w-full rounded-xl p-3 text-sm leading-relaxed" style={{ background: "#F0EBE1", color: "#6B5D4F" }}>
                  {text}
                </div>
              </div>
            )}

            {isDone && (
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
              >
                Готово
              </button>
            )}

          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
