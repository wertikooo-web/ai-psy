"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/mockData";
import { Send, BrainCircuit, User, ChevronsLeft, ChevronsRight, MessagesSquare } from "lucide-react";
import clsx from "clsx";

interface ChatPanelProps {
  messages: ChatMessage[];
  pendingMessage?: string | null;
  onMessageConsumed?: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const MOCK_RESPONSES = [
  "Отличный вопрос! На основе транскрипта этой сессии могу предложить несколько наблюдений...",
  "Обратите внимание на момент 03:05 — клиент впервые назвал страх отвержения напрямую. Это важный сдвиг.",
  "Паттерн, который вы описываете, хорошо соотносится с концепцией тревожной привязанности (Ainsworth). Рекомендую исследовать раннее окружение клиента.",
  "Для следующей сессии рекомендую технику somatic tracking — она поможет клиенту замедлить автоматическую реакцию.",
  "Динамика терапии позитивная. Клиент демонстрирует нарастающую способность к рефлексии.",
];

const QUICK_PROMPTS = ["Что важно на следующей сессии?", "Ключевой инсайт?", "Риски?"];

export function ChatPanel({
  messages: initial,
  pendingMessage,
  onMessageConsumed,
  collapsed,
  onToggle,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  // Inject message from "dig deeper" cards
  useEffect(() => {
    if (!pendingMessage) return;
    setInput(pendingMessage);
    onMessageConsumed?.();
    textareaRef.current?.focus();
  }, [pendingMessage, onMessageConsumed]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function send() {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id:        `u${Date.now()}`,
      role:      "user",
      content:   input,
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id:        `a${Date.now()}`,
        role:      "assistant",
        content:   MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)],
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((m) => [...m, aiMsg]);
      setLoading(false);
    }, 1200);
  }

  // ── Collapsed: narrow vertical tab ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-white border-l border-slate-100">
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
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">

      {/* Panel header — fixed */}
      <div className="px-5 pt-4 pb-3 border-b border-emerald-600 flex-shrink-0 bg-emerald-600">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessagesSquare size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Чат по консультации</h2>
              <p className="text-xs text-emerald-100">Задавайте вопросы по этой сессии</p>
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

      {/* Messages — scrolls independently */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const isAI = msg.role === "assistant";
          return (
            <div key={msg.id} className={clsx("flex gap-2.5", isAI ? "flex-row" : "flex-row-reverse")}>
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                isAI ? "bg-brand-100" : "bg-slate-100"
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
                    ? "bg-slate-50 text-slate-700 rounded-tl-sm"
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
            <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — fixed */}
      <div className="px-4 pt-2 pb-1 flex-shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input — fixed at bottom */}
      <div className="px-4 pt-3 pb-24 lg:pb-3 border-t border-slate-100 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Спросите об этой консультации..."
            rows={1}
            className="flex-1 resize-none text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-slate-300 overflow-hidden"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
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
