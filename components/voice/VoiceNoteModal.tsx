"use client";

import { useState, useRef, useEffect } from "react";
import { X, Mic, Square, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface Client       { id: string; name: string; }
interface Consultation { id: string; clientName: string; title?: string; topic?: string; createdAt: string; }

interface Props {
  onClose: () => void;
  defaultClientId?:      string;
  defaultClientName?:    string;
  defaultConsultationId?:string;
  defaultConsultationTitle?: string;
}

type Phase = "idle" | "recording" | "stopped" | "saving" | "transcribing" | "done";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const FIELD = {
  background: "#FFFFFF", borderColor: "#D8CFBE", color: "#3A2E22",
  borderRadius: "0.75rem", border: "1px solid #D8CFBE",
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", width: "100%",
  outline: "none",
} as const;

export function VoiceNoteModal({
  onClose,
  defaultClientId, defaultClientName,
  defaultConsultationId, defaultConsultationTitle,
}: Props) {
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [elapsed,   setElapsed]   = useState(0);
  const [blob,      setBlob]      = useState<Blob | null>(null);
  const [text,      setText]      = useState("");
  const [error,     setError]     = useState("");

  // Destination
  const [destType,  setDestType]  = useState<"none" | "client" | "consultation">(
    defaultConsultationId ? "consultation" : defaultClientId ? "client" : "none"
  );
  const [clients,      setClients]       = useState<Client[]>([]);
  const [consultations,setConsultations] = useState<Consultation[]>([]);
  const [selClient,    setSelClient]     = useState(defaultClientId ?? "");
  const [selClientName,setSelClientName] = useState(defaultClientName ?? "");
  const [selCons,      setSelCons]       = useState(defaultConsultationId ?? "");
  const [selConsTitle, setSelConsTitle]  = useState(defaultConsultationTitle ?? "");

  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/clients").then(r => r.ok ? r.json() : []).then((arr: {id:string;name:string}[]) => setClients(arr)).catch(()=>{});
    fetch("/api/consultations").then(r => r.ok ? r.json() : []).then((arr: Consultation[]) => setConsultations(arr)).catch(()=>{});
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  async function transcribe(id: string, audioPath: string) {
    setPhase("transcribing");
    const res = await fetch("/api/voice-notes/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, audioPath }),
    });
    const data = await res.json();
    if (data.text) setText(data.text);
    else setError("Не удалось транскрибировать. Запись сохранена.");
  }

  async function save(withTranscription: boolean) {
    if (!blob) return;
    setPhase("saving");
    setError("");

    const id   = `vn-${Date.now()}`;
    const form = new FormData();
    form.append("audio",        blob, `voice-${id}.webm`);
    form.append("id",           id);
    form.append("durationSec",  String(elapsed));
    if (destType === "client" && selClient) {
      form.append("clientId",   selClient);
      form.append("clientName", selClientName);
    }
    if (destType === "consultation" && selCons) {
      form.append("consultationId",    selCons);
      form.append("consultationTitle", selConsTitle);
    }

    const res = await fetch("/api/voice-notes", { method: "POST", body: form });
    if (!res.ok) { setError("Ошибка сохранения"); setPhase("stopped"); return; }

    if (withTranscription) {
      await transcribe(id, `/uploads/voice-${id}.webm`);
    }

    setPhase("done");
  }

  function handleClientChange(id: string) {
    setSelClient(id);
    const c = clients.find(c => c.id === id);
    setSelClientName(c?.name ?? "");
  }

  function handleConsChange(id: string) {
    setSelCons(id);
    const c = consultations.find(c => c.id === id);
    setSelConsTitle(c?.title || c?.topic || `Консультация · ${c?.clientName}`);
  }

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
                <Mic size={14} style={{ color: "#6B5D4F" }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#3A2E22" }}>Голосовая заметка</span>
            </div>
            <button onClick={onClose} style={{ color: "#A8997F" }}><X size={16} /></button>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Recorder */}
            <div className="flex flex-col items-center gap-4 py-2">
              {phase === "idle" && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105"
                  style={{ background: "#6B5D4F" }}
                >
                  <Mic size={26} color="white" />
                </button>
              )}

              {phase === "recording" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-2xl font-mono font-semibold" style={{ color: "#3D3228" }}>{fmt(elapsed)}</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-105"
                    style={{ background: "#C9BBAA" }}
                  >
                    <Square size={20} color="#3D3228" fill="#3D3228" />
                  </button>
                  <span className="text-xs" style={{ color: "#A8997F" }}>Нажмите, чтобы остановить</span>
                </>
              )}

              {(phase === "saving" || phase === "transcribing") && (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="animate-spin" style={{ color: "#A8997F" }} />
                  <span className="text-sm" style={{ color: "#A8997F" }}>
                    {phase === "transcribing" ? "Транскрибирую..." : "Сохраняю..."}
                  </span>
                </div>
              )}

              {phase === "done" && (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                  <span className="text-sm font-medium" style={{ color: "#3D3228" }}>Заметка сохранена</span>
                  {text && (
                    <p className="text-xs text-center leading-relaxed max-w-xs" style={{ color: "#6B5D4F" }}>{text}</p>
                  )}
                </div>
              )}

              {phase === "stopped" && (
                <div className="text-center">
                  <div className="text-lg font-mono font-semibold mb-1" style={{ color: "#3D3228" }}>{fmt(elapsed)}</div>
                  <span className="text-xs" style={{ color: "#A8997F" }}>Запись готова</span>
                </div>
              )}
            </div>

            {/* Destination — shown when stopped */}
            {phase === "stopped" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "#A8997F" }}>Куда сохранить</label>
                  <div className="relative">
                    <select
                      value={destType}
                      onChange={e => setDestType(e.target.value as typeof destType)}
                      style={FIELD}
                      className="appearance-none pr-8 cursor-pointer"
                    >
                      <option value="none">Без привязки (отдельно)</option>
                      <option value="client">Клиенту</option>
                      <option value="consultation">К консультации</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
                  </div>
                </div>

                {destType === "client" && (
                  <div className="relative">
                    <select
                      value={selClient}
                      onChange={e => handleClientChange(e.target.value)}
                      style={FIELD}
                      className="appearance-none pr-8 cursor-pointer"
                    >
                      <option value="">Выберите клиента...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
                  </div>
                )}

                {destType === "consultation" && (
                  <div className="relative">
                    <select
                      value={selCons}
                      onChange={e => handleConsChange(e.target.value)}
                      style={FIELD}
                      className="appearance-none pr-8 cursor-pointer"
                    >
                      <option value="">Выберите консультацию...</option>
                      {consultations.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.clientName} · {c.title || c.topic || new Date(c.createdAt).toLocaleDateString("ru-RU")}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#A8997F" }} />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-rose-500">{error}</p>}

            {/* Actions */}
            {phase === "stopped" && (
              <div className="flex gap-2.5">
                <button
                  onClick={() => save(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                  style={{ borderColor: "#D8CFBE", color: "#6B5D4F", background: "#F0EBE1" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E8E0D0"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#F0EBE1"; }}
                >
                  Сохранить
                </button>
                <button
                  onClick={() => save(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                  style={{ background: "#6B5D4F", color: "#FFFFFF" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#4A3C2E"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
                >
                  <Mic size={13} />
                  Транскрибировать
                </button>
              </div>
            )}

            {phase === "done" && (
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
