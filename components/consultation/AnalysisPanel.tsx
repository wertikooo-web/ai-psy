"use client";

import { useState, useRef, useEffect } from "react";
import { AnalysisSection, ModeAnalysis, DigDeeperCard, VoiceObservation } from "@/lib/mockData";
import {
  ChevronRight, ChevronDown, BrainCircuit, User, Sparkles,
  GitCompare, Download, ChevronsLeft, ChevronsRight, Lightbulb, CalendarClock,
} from "lucide-react";
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
  collapsed: boolean;
  onToggle: () => void;
}

const EXTRA_MODES = [
  {
    icon: <BrainCircuit size={13} />,
    label: "Глубокий анализ",
    chatPrompt: "Сделай глубокий анализ этой сессии: эмоциональная динамика, повторяющиеся темы, данные против гипотез и непроработанные зоны.",
  },
  {
    icon: <User size={13} />,
    label: "Анализ работы психолога",
    chatPrompt: "Проанализируй работу психолога в этой сессии: качество вопросов, интервенции, терапевтический альянс и упущенные возможности.",
  },
  {
    icon: <Sparkles size={13} />,
    label: "Гештальт-анализ",
    chatPrompt: "Проведи гештальт-анализ сессии: фигура и фон, цикл контакта, прерывания (ретрофлексия, дефлексия), незавершённые ситуации и уровни осознавания.",
  },
  {
    icon: <Lightbulb size={13} />,
    label: "Работа с гипотезами",
    chatPrompt: "Сформулируй 3–5 рабочих гипотез по этой сессии: что может стоять за поведением клиента, какие паттерны прослеживаются, что стоит проверить в следующей встрече.",
  },
  {
    icon: <CalendarClock size={13} />,
    label: "Подготовка к следующей сессии",
    chatPrompt: "Помоги подготовиться к следующей сессии: что важно продолжить, какие темы остались незавершёнными, на что обратить внимание, какие вопросы стоит задать.",
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
  collapsed,
  onToggle,
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

  const hasVoice       = voiceAnalysis && voiceAnalysis.length > 0;
  const workingSections = modeAnalysis?.working ?? sections;
  const fallbackBlocks  = workingSections.slice(0, 3);
  const directions      = digDeeper ?? [];

  function handleExtraMode(prompt: string) {
    setMenuOpen(false);
    onSendToChat(prompt);
  }

  function handleCompare() {
    setMenuOpen(false);
    onCompare();
  }

  // ── Collapsed: narrow vertical tab ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden bg-white border-r border-slate-100">
        <button
          onClick={onToggle}
          title="Развернуть AI-анализ"
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 hover:bg-brand-50 transition-colors w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm group-hover:bg-brand-600 transition-colors">
            <ChevronsRight size={15} className="text-white" />
          </div>
          <span
            className="text-xs font-semibold text-brand-500 select-none group-hover:text-brand-600 transition-colors"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            AI-анализ
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">

      {/* Panel header — fixed */}
      <div className="px-5 pt-4 pb-3 border-b border-brand-600 flex-shrink-0 bg-brand-500">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <BrainCircuit size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI-анализ</h2>
              <p className="text-xs text-brand-100">Ключевые наблюдения и направления</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* "Ещё" dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  menuOpen
                    ? "bg-white/30 text-white border-white/30"
                    : "text-white/80 border-white/30 hover:bg-white/20 hover:text-white"
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

            {/* Collapse button */}
            <button
              onClick={onToggle}
              title="Свернуть"
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <ChevronsLeft size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Content — scrolls independently */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── 1. Что важно ── */}
        <div className="px-5 pt-6 pb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Что важно в этой сессии
          </p>

          {hasVoice ? (
            <div className="space-y-5">
              {voiceAnalysis!.map((obs, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-slate-400 mb-1.5">{obs.lead}</p>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{obs.body}</p>
                  {obs.tags && obs.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {obs.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-50 border border-slate-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {i < voiceAnalysis!.length - 1 && <div className="mt-5 border-t border-slate-50" />}
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

        {/* ── 2. Что дальше ── */}
        <div className="px-5 pb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
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

      {/* Footer — fixed */}
      <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <p className="text-xs text-slate-500 text-center font-medium">Только для специалиста · TRANSCRIPT AI</p>
      </div>
    </div>
  );
}
