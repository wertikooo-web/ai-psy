"use client";

import { useState, useRef, useEffect } from "react";
import { AnalysisSection, ModeAnalysis, DigDeeperCard, VoiceObservation } from "@/lib/mockData";
import {
  ChevronRight, ChevronDown, BrainCircuit, User, Sparkles,
  GitCompare, Download, ChevronsLeft, ChevronsRight, Lightbulb, CalendarClock, FileText,
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

  const [dlMenuOpen, setDlMenuOpen] = useState(false);
  const dlMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as Node)) setDlMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function buildAnalysisText(): string {
    const sects = modeAnalysis?.working ?? sections;
    const lines: string[] = [
      `AI-анализ сессии — ${clientName}`,
      `Дата: ${formattedDate}`,
      "", "═".repeat(52), "",
    ];
    sects.forEach((s) => {
      lines.push(`${s.title}`, "", s.content, "", "─".repeat(40), "");
    });
    return lines.join("\n");
  }

  function buildAnalysisMd(): string {
    const sects = modeAnalysis?.working ?? sections;
    const lines: string[] = [
      `# AI-анализ сессии`,
      `**Клиент:** ${clientName}  `,
      `**Дата:** ${formattedDate}`,
      "", "---", "",
    ];
    sects.forEach((s) => {
      lines.push(`## ${s.title}`, "", s.content, "");
    });
    return lines.join("\n");
  }

  function dlBlob(content: string, filename: string, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDownload(fmt: "txt" | "md" | "docx" | "pdf") {
    setDlMenuOpen(false);
    const baseName = `AI-анализ_${clientName}_${date}`;
    const sects = modeAnalysis?.working ?? sections;

    if (fmt === "txt") {
      dlBlob(buildAnalysisText(), `${baseName}.txt`);
    } else if (fmt === "md") {
      dlBlob(buildAnalysisMd(), `${baseName}.md`, "text/markdown;charset=utf-8");
    } else if (fmt === "docx") {
      const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
      const children: InstanceType<typeof Paragraph>[] = [
        new Paragraph({ text: "AI-анализ сессии", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: "Клиент: ", bold: true }), new TextRun(clientName)] }),
        new Paragraph({ children: [new TextRun({ text: "Дата: ", bold: true }), new TextRun(formattedDate)] }),
        new Paragraph({ text: "" }),
      ];
      sects.forEach((s) => {
        children.push(
          new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: s.content }),
          new Paragraph({ text: "" }),
        );
      });
      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBlob(doc);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(buffer);
      a.download = `${baseName}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
    } else if (fmt === "pdf") {
      const rows = sects.map(s =>
        `<div style="margin-bottom:20px">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1a1a1a">${s.title}</div>
          <div style="line-height:1.7;color:#333">${s.content.replace(/\n/g, "<br>")}</div>
        </div>`
      ).join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>AI-анализ — ${clientName}</title>
        <style>body{font-family:Georgia,serif;font-size:13px;max-width:720px;margin:40px auto;padding:0 20px}h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:12px;margin-bottom:28px}@media print{body{margin:0}}</style>
      </head><body>
        <h1>AI-анализ сессии</h1>
        <div class="meta">Клиент: <b>${clientName}</b> &nbsp;·&nbsp; ${formattedDate}</div>
        ${rows}
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`;
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    }
  }

  // ── Collapsed: narrow vertical tab ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col min-h-0 overflow-hidden border-r border-[#D8CFBE]" style={{ background: "#FAF8F5" }}>
        <button
          onClick={onToggle}
          title="Развернуть AI-анализ"
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 transition-colors w-full group"
          style={{ background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F0EAE0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ background: "#4A3C2E" }}>
            <ChevronsRight size={15} className="text-white" />
          </div>
          <span
            className="text-xs font-semibold select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#6B5D4F" }}
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
      <div
        className="px-5 py-4 flex-shrink-0 flex items-center gap-3"
        style={{ background: "#9C9289", borderBottom: "1px solid #8A8079" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <BrainCircuit size={15} style={{ color: "#FDFAF5" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold leading-tight" style={{ color: "#FDFAF5" }}>AI-анализ</h2>
          <p className="text-xs leading-tight mt-0.5" style={{ color: "#FDFAF5" }}>Анализ актуален</p>
        </div>
        <div ref={dlMenuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setDlMenuOpen(v => !v)}
            title="Скачать анализ"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: dlMenuOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.10)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.20)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = dlMenuOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.10)"; }}
          >
            <Download size={14} style={{ color: "#D8CFBE" }} />
          </button>
          {dlMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-100 shadow-lg z-30 py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Скачать анализ</div>
              {([
                { fmt: "txt", label: "Текст (.txt)" },
                { fmt: "md",  label: "Markdown (.md)" },
                { fmt: "docx", label: "Word (.docx)" },
                { fmt: "pdf",  label: "PDF (печать)" },
              ] as const).map(({ fmt, label }) => (
                <button
                  key={fmt}
                  onClick={() => handleDownload(fmt)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors text-left"
                >
                  <FileText size={12} className="text-slate-400" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          title="Свернуть"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.10)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.20)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
        >
          <ChevronsLeft size={14} style={{ color: "#D8CFBE" }} />
        </button>
      </div>

      {/* Extra modes dropdown — white zone below header */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0 bg-white">
        <div ref={menuRef} className="relative inline-block">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              menuOpen
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : "text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            Дополнительные режимы
            <ChevronDown size={12} className={clsx("transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-100 shadow-lg z-20 py-1 overflow-hidden">
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
                onClick={() => { setMenuOpen(false); handleDownload("txt"); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
              >
                <Download size={13} className="text-slate-400" />
                Скачать анализ (.txt)
              </button>
            </div>
          )}
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
