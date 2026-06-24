"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mic, Trash2, Play, Pause, User, FileText,
  Loader2, Headphones, AlertCircle, PenLine,
} from "lucide-react";
import type { VoiceNote } from "@/lib/voiceNoteStore";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
function formatDur(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

const C = {
  cardBg:   "#FBF8F2",
  cardBdr:  "#CFC0A9",
  head:     "#E9DCC7",
  headBdr:  "#D8CFBE",
  title:    "#3D3228",
  muted:    "#A8997F",
  tag:      "#E9DCC7",
  tagBdr:   "#D8CFBE",
  tagTxt:   "#6B5D4F",
};

function NoteCard({
  note,
  onDelete,
  onTranscribed,
  onAudioDeleted,
}: {
  note:           VoiceNote;
  onDelete:       () => void;
  onTranscribed:  (id: string, text: string) => void;
  onAudioDeleted: (id: string) => void;
}) {
  const hasAudio      = !!note.audioPath && !note.audioDeleted;
  const isVoice       = note.durationSec > 0 || hasAudio || note.audioDeleted;
  const [transcribing, setTranscribing] = useState(false);
  const [deletingAudio, setDeletingAudio] = useState(false);
  const [audioError, setAudioError]     = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const where =
    note.consultationTitle ? note.consultationTitle :
    note.clientName        ? note.clientName :
    "Без привязки";
  const whereIcon = (note.clientName || note.consultationTitle) ? <User size={11} /> : <FileText size={11} />;

  async function handleTranscribe() {
    if (!note.audioPath) return;
    setTranscribing(true);
    try {
      const res  = await fetch("/api/voice-notes/transcribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: note.id, audioPath: note.audioPath }),
      });
      const data = await res.json();
      if (data.text) onTranscribed(note.id, data.text);
    } finally {
      setTranscribing(false);
    }
  }

  async function handleDeleteAudio() {
    setDeletingAudio(true);
    setConfirmDel(false);
    try {
      await fetch(`/api/voice-notes/${note.id}/audio`, { method: "DELETE" });
      onAudioDeleted(note.id);
    } finally {
      setDeletingAudio(false);
    }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: C.cardBg, borderColor: C.cardBdr,
        boxShadow: "0 1px 3px rgba(80,60,40,0.06), 0 4px 10px rgba(80,60,40,0.06)" }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: C.head, borderBottom: `1px solid ${C.headBdr}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isVoice
            ? <Mic size={13} style={{ color: C.muted, flexShrink: 0 }} />
            : <PenLine size={13} style={{ color: C.muted, flexShrink: 0 }} />}
          <span className="text-xs font-medium truncate" style={{ color: C.tagTxt }}>
            {formatDate(note.createdAt)}
            {note.durationSec > 0 && ` · ${formatDur(note.durationSec)}`}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Delete whole note */}
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-rose-50"
            style={{ color: "#A8997F" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#A8997F"; }}
            title="Удалить заметку"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-4 space-y-3">

        {/* Context tag */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: C.tag, border: `1px solid ${C.tagBdr}`, color: C.tagTxt }}
          >
            {whereIcon}
            {where}
          </span>
        </div>

        {/* Audio player */}
        {hasAudio && (
          <div className="space-y-1.5">
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              src={`/api/voice-notes/${note.id}/audio`}
              onError={() => setAudioError(true)}
              className="w-full h-9"
              style={{ borderRadius: 8, accentColor: "#6B5D4F" }}
            />
            {audioError && (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle size={11} />
                Аудиофайл не найден — возможно, пропал после redeploy на Railway
              </p>
            )}
          </div>
        )}

        {/* Audio deleted notice */}
        {note.audioDeleted && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
            <Headphones size={12} />
            Аудио удалено, транскрипция сохранена
          </div>
        )}

        {/* Transcript text */}
        {note.text ? (
          <p className="text-sm leading-relaxed" style={{ color: C.title }}>{note.text}</p>
        ) : isVoice ? (
          <p className="text-sm italic" style={{ color: "#C9BBAA" }}>Транскрипция не создана</p>
        ) : null}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">

          {/* Transcribe button — only if audio exists and no text yet */}
          {hasAudio && !note.text && (
            <button
              onClick={handleTranscribe}
              disabled={transcribing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-60"
              style={{ background: "#6B5D4F", color: "#FFFFFF" }}
              onMouseEnter={e => { if (!transcribing) e.currentTarget.style.background = "#4A3C2E"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#6B5D4F"; }}
            >
              {transcribing
                ? <><Loader2 size={11} className="animate-spin" /> Транскрибирую...</>
                : <><Mic size={11} /> Транскрибировать</>}
            </button>
          )}

          {/* Delete audio button — only if transcribed and audio still exists */}
          {hasAudio && note.text && !note.audioDeleted && (
            confirmDel ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span style={{ color: C.muted }}>Удалить только аудиофайл? Текст останется.</span>
                <button
                  onClick={handleDeleteAudio}
                  disabled={deletingAudio}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors disabled:opacity-60"
                >
                  {deletingAudio ? "Удаляю..." : "Да, удалить"}
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: C.tag, color: C.tagTxt }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FECACA"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#FEE2E2"; }}
              >
                <Trash2 size={11} />
                Удалить аудио
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
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

  function handleTranscribed(id: string, text: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  }

  function handleAudioDeleted(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, audioPath: undefined, audioDeleted: true } : n));
  }

  const filtered = notes.filter(n => {
    if (filter === "none")         return !n.clientId && !n.consultationId;
    if (filter === "client")       return !!n.clientId && !n.consultationId;
    if (filter === "consultation") return !!n.consultationId;
    return true;
  });

  const filterTabs: { id: typeof filter; label: string }[] = [
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
            style={{ color: C.muted }}
            onMouseEnter={e => { e.currentTarget.style.color = C.title; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.muted; }}
          >
            <ArrowLeft size={16} />
            Назад
          </button>
          <div className="w-px h-5" style={{ background: C.headBdr }} />
          <h1 className="text-xl font-bold" style={{ color: C.title }}>Заметки</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "#C9BBAA" }}>
          Голосовые и текстовые · {notes.length}
        </p>

        {/* Filter tabs */}
        {notes.length > 0 && (
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {filterTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: filter === t.id ? "#6B5D4F" : C.cardBg,
                  color:      filter === t.id ? "#FFFFFF"  : C.tagTxt,
                  border:     `1px solid ${filter === t.id ? "#6B5D4F" : C.cardBdr}`,
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
              <div key={i} className="rounded-2xl border h-28 animate-pulse"
                style={{ background: C.cardBg, borderColor: C.cardBdr }} />
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
              <NoteCard
                key={note.id}
                note={note}
                onDelete={() => handleDelete(note.id)}
                onTranscribed={handleTranscribed}
                onAudioDeleted={handleAudioDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
