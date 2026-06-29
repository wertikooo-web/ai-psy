"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/mockData";
import {
  Send, BrainCircuit, User, ChevronsLeft, ChevronsRight,
  MessagesSquare, AlertCircle, Mic, MicOff, Trash2,
  BookmarkPlus, Check, Loader2, Download,
} from "lucide-react";
import clsx from "clsx";
import { CollapsedConsultationPanel } from "./CollapsedConsultationPanel";

interface ChatPanelProps {
  collapsed:           boolean;
  onToggle:            () => void;
  consultationId?:     string;
  pendingMessage?:     string | null;
  onMessageConsumed?:  () => void;
}

// Applied at render time to every AI message (covers both new and old stored messages).
function formatChatMessage(text: string): string {
  const t = text.trim();
  if (!t) return t;

  // 1. Already has paragraph breaks → fine as-is
  if (t.includes("\n\n")) return t;

  // 2. Has single line breaks → expand to paragraph breaks,
  //    but keep consecutive list-item lines together (- … / * … / 1. …)
  if (t.includes("\n")) {
    return t.replace(/\n(?=[^\n])/g, (_match: string, offset: number) => {
      const nextLine = t.slice(offset + 1);
      if (/^[-*•]\s/.test(nextLine) || /^\d+[.)]\s/.test(nextLine)) return "\n";
      return "\n\n";
    });
  }

  // 3. Solid wall of text — split only if long enough and multi-sentence
  if (t.length < 280) return t;

  // Safe sentence split: break at [.!?] + whitespace + Cyrillic/Latin uppercase.
  // Character-by-character avoids regex misfires on т.е., т.д., decimals, initials.
  const sentences: string[] = [];
  let cur = "";
  for (let i = 0; i < t.length; i++) {
    cur += t[i];
    const ch    = t[i];
    const next  = t[i + 1] ?? "";
    const after = t[i + 2] ?? "";
    if (/[.!?]/.test(ch) && /\s/.test(next) && /[А-ЯЁA-Z]/.test(after)) {
      sentences.push(cur.trim());
      cur = "";
      i++; // skip the space separator
    }
  }
  if (cur.trim()) sentences.push(cur.trim());
  if (sentences.length <= 2) return t;

  // Group 2 sentences per paragraph
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paras.push(sentences.slice(i, i + 2).join(" "));
  }
  return paras.join("\n\n");
}

const QUICK_PROMPTS = [
  "Что важно на следующей сессии?",
  "Ключевой инсайт?",
  "Риски?",
  "Какие техники использовать?",
];

export function ChatPanel({
  collapsed,
  onToggle,
  consultationId,
  pendingMessage,
  onMessageConsumed,
}: ChatPanelProps) {
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [listening, setListening]         = useState(false);
  const [clearPending, setClearPending]   = useState(false);
  const [clearLoading, setClearLoading]   = useState(false);
  const [saveState,    setSaveState]      = useState<"idle" | "saving" | "saved" | "error">("idle");
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // ── Load history on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!consultationId) { setHistoryLoaded(true); return; }
    (async () => {
      try {
        const res = await fetch(`/api/consultations/${consultationId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch {
        // Non-critical: start with empty chat if fetch fails
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [consultationId]);

  // ── Pending message from parent ───────────────────────────────────────────
  useEffect(() => {
    if (!pendingMessage) return;
    setInput(pendingMessage);
    onMessageConsumed?.();
    textareaRef.current?.focus();
  }, [pendingMessage, onMessageConsumed]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!historyLoaded) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, historyLoaded]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function toggleListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setError("Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge.");
      return;
    }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput(prev => prev ? prev + " " + transcript : transcript);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function send() {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id:        `u${Date.now()}`,
      role:      "user",
      content:   input.trim(),
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка ответа");

      const aiMsg: ChatMessage = {
        id:        `a${Date.now()}`,
        role:      "assistant",
        content:   formatChatMessage(data.reply),
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(m => [...m, aiMsg]);

      // Persist both messages in background
      if (consultationId) {
        fetch(`/api/consultations/${consultationId}/chat`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user",      content: userMsg.content },
              { role: "assistant", content: aiMsg.content },
            ],
          }),
        }).catch((err) => console.error("[chat/save]", err));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearConfirmed() {
    if (!consultationId) { setMessages([]); setClearPending(false); return; }
    setClearLoading(true);
    try {
      await fetch(`/api/consultations/${consultationId}/chat`, { method: "DELETE" });
      setMessages([]);
    } catch {
      setMessages([]);
    } finally {
      setClearLoading(false);
      setClearPending(false);
    }
  }

  function handleDownloadChat() {
    if (messages.length === 0) return;
    const lines: string[] = [
      "Чат по консультации",
      `Дата: ${new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}`,
      "",
      "═".repeat(52),
      "",
      ...messages.map(m =>
        `${m.role === "user" ? "Психолог" : "AI"} [${m.timestamp ?? ""}]:\n${m.content}`
      ).join("\n\n—\n\n").split("\n"),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Чат_консультация_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }



  async function handleSaveChat() {
    if (!consultationId || messages.length === 0 || saveState === "saving") return;
    setSaveState("saving");
    try {
      const consultRes = await fetch(`/api/consultations/${consultationId}`);
      if (!consultRes.ok) throw new Error();
      const consult = await consultRes.json();

      const content = messages
        .map(m => `${m.role === "user" ? "Психолог" : "AI"} [${m.timestamp ?? ""}]:\n${m.content}`)
        .join("\n\n—\n\n");

      const res = await fetch(`/api/client-materials/${consult.clientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:           "ai_chat",
          title:          `Чат — ${consult.title || "Консультация"}`,
          content,
          consultationId,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setTimeout(() => setSaveState("idle"), 2800);
    }
  }

  // ── Collapsed ─────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <CollapsedConsultationPanel
        label="Чат"
        icon={<MessagesSquare size={14} color="white" />}
        bg="#059669"
        hoverBg="#047857"
        expandDirection="left"
        onExpand={onToggle}
        tooltip="Развернуть чат"
      />
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#FAF8F5]">

      {/* Header */}
      <div className="px-5 border-b border-emerald-600 flex-shrink-0 bg-emerald-600 flex items-center" style={{ height: 68 }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessagesSquare size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Чат по консультации</h2>
              <p className="text-xs text-emerald-100">
                {consultationId ? "AI анализирует транскрипт сессии + материалы" : "Задавайте вопросы по этой сессии"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && !clearPending && (
              <button
                onClick={() => setClearPending(true)}
                title="Очистить историю чата"
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <Trash2 size={13} className="text-white/80" />
              </button>
            )}
            {clearPending && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
                <span className="text-xs text-white/90">Удалить чат?</span>
                <button
                  onClick={handleClearConfirmed}
                  disabled={clearLoading}
                  className="text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded px-1.5 py-0.5 transition-colors disabled:opacity-60"
                >
                  {clearLoading ? "…" : "Да"}
                </button>
                <button
                  onClick={() => setClearPending(false)}
                  className="text-xs text-white/70 hover:text-white transition-colors"
                >
                  Отмена
                </button>
              </div>
            )}
            <button
              onClick={handleDownloadChat}
              title="Скачать чат"
              disabled={messages.length === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.10)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
            >
              <Download size={14} className="text-white" />
            </button>
            <button
              onClick={onToggle}
              title="Свернуть"
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ChevronsLeft size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-panel: tabs + actions */}
      <div className="consultation-toolbar items-center justify-between px-3" style={{ background: "#F5F0E8", borderBottom: "1px solid #D8CFBE" }}>

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
        </div>

        <div className="flex items-center gap-1.5">
            <a
              href="https://chatgpt.com/g/g-6a39895c066481919568675af786bde7-transcript-ai-psy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Открыть персональный GPTS психолога"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#E8E3DA", color: "#6B5E4E", border: "1px solid #D0C7BA" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#DDD7CE")}
              onMouseLeave={e => (e.currentTarget.style.background = "#E8E3DA")}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              GPTS
            </a>
            <button
              onClick={handleSaveChat}
              disabled={messages.length === 0 || saveState === "saving"}
              aria-label="Сохранить чат"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: saveState === "saved" ? "#D4EDD9" : saveState === "error" ? "#FDECEA" : "#E8E3DA",
                color:      saveState === "saved" ? "#2D6A4F" : saveState === "error" ? "#B91C1C" : "#6B5E4E",
                border: `1px solid ${saveState === "saved" ? "#A8D4B0" : saveState === "error" ? "#FECACA" : "#D0C7BA"}`,
              }}
              onMouseEnter={e => { if (saveState === "idle") e.currentTarget.style.background = "#DDD7CE"; }}
              onMouseLeave={e => { if (saveState === "idle") e.currentTarget.style.background = "#E8E3DA"; }}
            >
              {saveState === "saving" ? <Loader2 size={11} className="animate-spin" />
             : saveState === "saved"  ? <Check size={11} />
             : <BookmarkPlus size={11} />}
              {saveState === "saving" ? "Сохраняю…" : saveState === "saved" ? "Сохранено" : saveState === "error" ? "Ошибка" : "Сохранить"}
            </button>
          </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {!historyLoaded && (
          <div className="flex justify-center py-4">
            <span className="text-xs text-slate-300">Загрузка истории…</span>
          </div>
        )}

        {historyLoaded && messages.length === 0 && !loading && (
          <div className="flex justify-center py-8">
            <span className="text-xs text-slate-300">История чата пуста</span>
          </div>
        )}

        {messages.map((msg) => {
          const isAI = msg.role === "assistant";
          return (
            <div key={msg.id} className={clsx("flex gap-2.5", isAI ? "flex-row" : "flex-row-reverse")}>
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                isAI ? "bg-brand-100" : "bg-[#EDE7DA]"
              )}>
                {isAI
                  ? <BrainCircuit size={11} className="text-brand-500" />
                  : <User size={11} className="text-slate-400" />
                }
              </div>
              <div className={clsx("max-w-[85%]", !isAI && "flex flex-col items-end")}>
                <div className={clsx(
                  "text-sm leading-relaxed rounded-2xl px-3.5 py-2.5",
                  isAI
                    ? "bg-[#F3EDE2] text-slate-700 rounded-tl-sm"
                    : "bg-brand-500 text-white rounded-tr-sm whitespace-pre-wrap"
                )}>
                  {isAI ? (
                    <span style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", display: "block" }}>
                      {formatChatMessage(msg.content)}
                    </span>
                  ) : msg.content}
                </div>
                <span className="text-xs text-slate-300 mt-1 px-1">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <BrainCircuit size={11} className="text-brand-500" />
            </div>
            <div className="bg-[#F3EDE2] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9BBAA] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9BBAA] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9BBAA] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 pt-2 pb-1 flex-shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); textareaRef.current?.focus(); }}
              className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pt-3 pb-3 border-t flex-shrink-0" style={{ borderColor: "#E0D8CA", paddingRight: "88px" }}>
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={listening ? "Слушаю..." : "Спросите об этой консультации..."}
              rows={1}
              className="w-full resize-none text-sm px-3.5 py-2.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-slate-300 overflow-hidden"
              style={{ border: `1px solid ${listening ? "#6ee7b7" : "#D8CFBE"}`, background: "#FAF8F5", minHeight: "40px", maxHeight: "120px" }}
            />
            <button
              onClick={toggleListening}
              title={listening ? "Остановить запись" : "Голосовой ввод"}
              className="absolute right-2.5 bottom-2 flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: 24, height: 24,
                color: listening ? "#059669" : "#94a3b8",
                background: listening ? "#d1fae5" : "transparent",
              }}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          </div>
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-500 text-center font-medium mt-1.5">Enter — отправить · Shift+Enter — перенос</p>
      </div>
    </div>
  );
}
