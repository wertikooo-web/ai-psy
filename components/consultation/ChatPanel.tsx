"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/mockData";
import { Send, BrainCircuit, User } from "lucide-react";
import clsx from "clsx";

interface ChatPanelProps {
  messages: ChatMessage[];
  pendingMessage?: string | null;
  onMessageConsumed?: () => void;
}

const MOCK_RESPONSES = [
  "Отличный вопрос! На основе транскрипта этой сессии могу предложить несколько наблюдений...",
  "Обратите внимание на момент 03:05 — клиент впервые назвал страх отвержения напрямую. Это важный сдвиг.",
  "Паттерн, который вы описываете, хорошо соотносится с концепцией тревожной привязанности (Ainsworth). Рекомендую исследовать раннее окружение клиента.",
  "Для следующей сессии рекомендую технику somatic tracking — она поможет клиенту замедлить автоматическую реакцию.",
  "Динамика терапии позитивная. Клиент демонстрирует нарастающую способность к рефлексии.",
];

export function ChatPanel({ messages: initial, pendingMessage, onMessageConsumed }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Inject message from "dig deeper" cards
  useEffect(() => {
    if (!pendingMessage) return;
    setInput(pendingMessage);
    onMessageConsumed?.();
    // Auto-scroll to input area
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pendingMessage, onMessageConsumed]);

  const send = () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)],
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((m) => [...m, aiMsg]);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-500 flex items-center justify-center">
            <BrainCircuit size={13} className="text-white" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Чат по консультации</h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 ml-8">AI знает контекст этой сессии</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
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
              <div className={clsx("max-w-[85%]", isAI ? "" : "items-end flex flex-col")}>
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

        <div ref={bottomRef} />

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
      </div>

      {/* Suggestions */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {["Что важно на следующей сессии?", "Ключевой инсайт?", "Риски?"].map((s) => (
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

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Спросите об этой консультации..."
            rows={2}
            className="flex-1 resize-none text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 placeholder:text-slate-300 scrollbar-thin"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-300 text-center mt-1.5">Enter — отправить · Shift+Enter — перенос</p>
      </div>
    </div>
  );
}
