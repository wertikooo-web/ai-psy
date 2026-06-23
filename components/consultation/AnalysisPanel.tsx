"use client";

import { useState, useRef, useEffect } from "react";
import { AnalysisSection, ModeAnalysis, DigDeeperCard, VoiceObservation } from "@/lib/mockData";
import { ChevronRight, ChevronDown, BrainCircuit, User, Sparkles, GitCompare, Download } from "lucide-react";
import clsx from "clsx";

interface AnalysisPanelProps {
  sections: AnalysisSection[];
  modeAnalysis?: ModeAnalysis;
  digDeeper?: DigDeeperCard[];
  voiceAnalysis?: VoiceObservation[];
  clientName: string;
  date: string;
  onSendToChat: (text: string) => void;
  onCompare: () => void;
}

const EXTRA_MODES = [
  {
    icon: <BrainCircuit size={13} />,
    label: "Глубокий анализ",
    chatPrompt: "Сделай глубокий анализ этой сессии: эмоциональная динамика, повторяющиеся темы, данные против гипотез и непроработанные зоны.",
  },
  {
    icon: <User size={13} />,
    label: "Анализ работы психолога (+A)",
    chatPrompt: "Проанализируй работу психолога в этой сессии: качество вопросов, интервенции, терапевтический альянс и упущенные возможности.",
  },
  {
    icon: <Sparkles size={13} />,
    label: "Гештальт-анализ (+G)",
    chatPrompt: "Проведи гештальт-анализ сессии: фигура и фон, цикл контакта, прерывания (ретрофлексия, дефлексия), незавершённые ситуации и уровни осознавания.",
  },
];

export function AnalysisPanel({
  sections,
  modeAnalysis,
  digDeeper,
  voiceAnalysis,
  clientName,
  date,
  onSendToChat,
  onCompare,
}: AnalysisPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formattedDate = new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  // "Что важно" — prefer voiceAnalysis, fallback to working mode first 3 blocks
  const hasVoice = voiceAnalysis && voiceAnalysis.length > 0;
  const workingSections = modeAnalysis?.working ?? sections;
  const fallbackBlocks = workingSections.slice(0, 3);
  const directions = digDeeper ?? [];

  function handleExtraMode(prompt: string) {
    setMenuOpen(false);
    onSendToChat(prompt);
  }

  function handleCompare() {
    setMenuOpen(false);
    onCompare();
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-700">{clientName}</span>
            <span className="text-xs text-slate-400 ml-2">{formattedDate}</span>
          </div>

          {/* "Ещё" dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                menuOpen
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              Ещё
              <ChevronDown size={12} className={clsx("transition-transform", menuOpen && "rotate-180")} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-100 shadow-lg z-20 py-1 overflow-hidden">
                <div className="px-3 py-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Дополнительные режимы
                  </span>
                </div>
                {EXTRA_MODES.map(({ icon, label, chatPrompt }) => (
                  <button
                    key={label}
                    onClick={() => handleExtraMode(chatPrompt)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-slate-400">{icon}</span>
                    {label}
                  </button>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={handleCompare}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
                >
                  <GitCompare size={13} className="text-slate-400" />
                  Сравнить с предыдущей сессией
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left cursor-not-allowed"
                >
                  <Download size={13} className="text-slate-300" />
                  <span className="text-slate-300">Экспорт отчёта</span>
                  <span className="ml-auto text-xs text-slate-200">скоро</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* ── 1 · Что важно — voice of a colleague ── */}
        <div className="px-5 pt-6 pb-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">
            Что важно в этой сессии
          </p>

          {hasVoice ? (
            <div className="space-y-5">
              {voiceAnalysis!.map((obs, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-slate-400 mb-1.5">
                    {obs.lead}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    {obs.body}
                  </p>
                  {obs.tags && obs.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {obs.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-50 border border-slate-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {i < voiceAnalysis!.length - 1 && (
                    <div className="mt-5 border-t border-slate-50" />
                  )}
                </div>
              ))}
            </div>
          ) : fallbackBlocks.length > 0 ? (
            <div className="space-y-3">
              {fallbackBlocks.map((block, i) => (
                <div key={i} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">{block.title}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{block.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic py-6 text-center">Анализ ещё не готов</p>
          )}
        </div>

        <div className="mx-5 my-4 border-t border-slate-100" />

        {/* ── 2 · Что дальше ── */}
        <div className="px-5 pb-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">
            Что можно исследовать дальше
          </p>

          {directions.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">Нет направлений</p>
          ) : (
            <div className="space-y-1.5">
              {directions.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onSendToChat(card.chatPrompt)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40 transition-all text-left group"
                >
                  <span className="text-base flex-shrink-0">{card.emoji}</span>
                  <span className="text-sm text-slate-600 group-hover:text-brand-700 flex-1 leading-snug">
                    {card.label}
                  </span>
                  <ChevronRight size={14} className="text-slate-200 group-hover:text-brand-400 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-xs text-slate-300 text-center">Только для специалиста · TRANSCRIPT AI</p>
      </div>
    </div>
  );
}
