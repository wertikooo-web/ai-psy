"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/mockData";
import { Send, BrainCircuit, User, ChevronsLeft, ChevronsRight, MessagesSquare, AlertCircle, Mic, MicOff } from "lucide-react";
import clsx from "clsx";

interface ChatPanelProps {
  messages:             ChatMessage[];
  pendingMessage?:      string | null;
  onMessageConsumed?:   () => void;
  collapsed:            boolean;
  onToggle:             () => void;
  consultationId?:      string;
  transcriptText?:      string;
}

const QUICK_PROMPTS = [
  "Что важно на следующей сессии?",
  "Ключевой инсайт?",
  "Риски?",
  "Какие техники использовать?",
];

export function ChatPanel({
  messages: initial,
  pendingMessage,
  onMessageConsumed,
  collapsed,
  onToggle,
  consultationId,
  transcriptText,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  function toggleListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) {
      setError("Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

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

  useEffect(() => {
    if (!pendingMessage) return;
    setInput(pendingMessage);
    onMessageConsumed?.();
    textareaRef.current?.focus();
  }, [pendingMessage, onMessageConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
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
          transcriptText,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка ответа");

      const aiMsg: ChatMessage = {
        id:        `a${Date.now()}`,
        role:      "assistant",
        content:   data.reply,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(m => [...m, aiMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setLoading(false);
    }
  }

  // ── Collapsed ────────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-[#FAF8F5] border-l border-[#D8CFBE]">
        <button
          onClick={onToggle}
          title="Развернуть чат"
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 hover:bg-brand-50 transition-colors w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm group-hover:bg-brand-600 transition-colors">
            <ChevronsRight size={15} className="text-white" />
          </div>
          <span
            className="text-xs font-semibold text-brand-500 select-none group-hover:text-brand-600 transition-colors"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Чат
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#FAF8F5]">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-emerald-600 flex-shrink-0 bg-emerald-600">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessagesSquare size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Чат по консультации</h2>
              <p className="text-xs text-emerald-100">
                {transcriptText || consultationId ? "AI анализирует транскрипт сессии" : "Задавайте вопросы по этой сессии"}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Свернуть"
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ChevronsLeft size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
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
                  "text-sm leading-relaxed rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap",
                  isAI
                    ? "bg-[#F3EDE2] text-slate-700 rounded-tl-sm"
                    : "bg-brand-500 text-white rounded-tr-sm"
                )}>
                  {msg.content}
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

      {/* Input — right padding reserves space for the fixed FAB button (56px + 24px offset + 8px gap) */}
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
