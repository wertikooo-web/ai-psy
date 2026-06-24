"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Trash2, Play, Pause, User, FileText } from "lucide-react";
import type { VoiceNote } from "@/lib/voiceNoteStore";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
function formatDur(sec: number) {
  const m = Math.floor(sec / 60); const s = sec % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

function NoteCard({ note, onDelete }: { note: VoiceNote; onDelete: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [audio]   = useState(() => note.audioPath ? new Audio(note.audioPath) : null);

  useEffect(() => {
    if (!audio) return;
    audio.onended = () => setPlaying(false);
    return () => { audio.pause(); };
  }, [audio]);

  function togglePlay() {
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play(); setPlaying(true); }
  }

  const where =
    note.consultationTitle ? `Консультация: ${note.consultationTitle}` :
    note.clientName        ? `Клиент: ${note.clientName}` :
    "Без привязки";

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{ background: "#E8E0D0", borderColor: "#DDD4C6" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Mic size={14} style={{ color: "#A8997F", flexShrink: 0 }} />
          <span className="text-xs font-medium truncate" style={{ color: "#6B5D4F" }}>
            {formatDate(note.createdAt)} · {formatDur(note.durationSec)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {note.audioPath && (
            <button
              onClick={togglePlay}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: playing ? "#C9BBAA" : "#D8CFBE" }}
              title={playing ? "Пауза" : "Воспроизвести"}
            >
              {playing ? <Pause size={12} style={{ color: "#4A3C2E" }} /> : <Play size={12} style={{ color: "#4A3C2E" }} />}
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-stone-300 hover:text-rose-500 hover:bg-rose-50"
            title="Удалить"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 space-y-2">
        {/* Where */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A8997F" }}>
          {note.clientName || note.consultationTitle
            ? <User size={11} />
            : <FileText size={11} />}
          {where}
        </div>

        {/* Text */}
        {note.text ? (
          <p className="text-sm leading-relaxed" style={{ color: "#3D3228" }}>{note.text}</p>
        ) : (
          <p className="text-sm italic" style={{ color: "#C9BBAA" }}>Транскрипция не создана</p>
        )}
      </div>
    </div>
  );
}

export default function VoiceNotesPage() {
  const router = useRouter();
  const [notes,   setNotes]   = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"all" | "none" | "client" | "consultation">("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/voice-notes");
      setNotes(res.ok ? await res.json() : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/voice-notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  const filtered = notes.filter(n => {
    if (filter === "none")         return !n.clientId && !n.consultationId;
    if (filter === "client")       return !!n.clientId && !n.consultationId;
    if (filter === "consultation") return !!n.consultationId;
    return true;
  });

  const tabs: { id: typeof filter; label: string }[] = [
    { id: "all",          label: "Все" },
    { id: "none",         label: "Без привязки" },
    { id: "client",       label: "По клиентам" },
    { id: "consultation", label: "По консультациям" },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="px-4 sm:p-8 max-w-2xl mx-auto py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "#A8997F" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#4A3C2E"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#A8997F"; }}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
          <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>Голосовые заметки</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "#C9BBAA" }}>
          Все голосовые заметки · {notes.length}
        </p>

        {/* Filter tabs */}
        {notes.length > 0 && (
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: filter === t.id ? "#6B5D4F" : "#F0EBE1",
                  color:      filter === t.id ? "#FFFFFF"  : "#6B5D4F",
                  border:     `1px solid ${filter === t.id ? "#6B5D4F" : "#D8CFBE"}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border h-24 animate-pulse" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "#C9BBAA" }}>
            {notes.length === 0
              ? "Заметок пока нет. Нажмите кнопку 🎙 чтобы записать первую."
              : "Нет заметок в этой категории."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(note => (
              <NoteCard key={note.id} note={note} onDelete={() => handleDelete(note.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
