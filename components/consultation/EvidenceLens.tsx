"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, ScanSearch, ChevronDown, ChevronRight,
  Quote, Repeat2, HelpCircle, Shuffle, AlertTriangle,
} from "lucide-react";
import type { AnalysisEvidence } from "@/lib/consultationStore";

// ── Design tokens ────────────────────────────────────────────────────────────

const S = {
  bg:      "#FAF8F5",
  bgSub:   "#F0EBE1",
  border:  "#D8CFBE",
  divider: "#EDE8DE",
  title:   "#3D3228",
  sub:     "#6B5D4F",
  muted:   "#9C8E80",
  staleBg: "#FEF3DC",
  staleText:"#7A5420",
  staleBorder:"#E8C97A",
};

// ── Confidence dot ────────────────────────────────────────────────────────────

function Dot({ level }: { level: "high" | "medium" | "low" }) {
  const cls =
    level === "high"   ? "bg-emerald-400" :
    level === "medium" ? "bg-amber-400"   : "bg-slate-300";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-px ${cls}`} />;
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({
  icon, title, count, children, defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: S.border }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        style={{ background: S.bgSub }}
      >
        <span style={{ color: S.muted }}>{icon}</span>
        <span className="text-xs font-semibold flex-1" style={{ color: S.sub }}>{title}</span>
        {count !== undefined && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-md leading-none"
            style={{ background: "#D4C5B1", color: S.sub }}
          >
            {count}
          </span>
        )}
        {open
          ? <ChevronDown size={13} style={{ color: S.muted }} />
          : <ChevronRight size={13} style={{ color: S.muted }} />}
      </button>
      {open && <div style={{ background: S.bg }}>{children}</div>}
    </div>
  );
}

// ── Divider line ──────────────────────────────────────────────────────────────

function Div() {
  return <div style={{ height: 1, background: S.divider }} />;
}

// ── Main component ────────────────────────────────────────────────────────────

interface State {
  loading:       boolean;
  generating:    boolean;
  evidence:      AnalysisEvidence | null;
  isStale:       boolean;
  hasTranscript: boolean;
  error:         string | null;
}

export function EvidenceLens({ consultationId }: { consultationId: string }) {
  const [st, setSt] = useState<State>({
    loading: true, generating: false,
    evidence: null, isStale: false, hasTranscript: false, error: null,
  });

  const load = useCallback(() => {
    setSt(s => ({ ...s, loading: true, error: null }));
    fetch(`/api/evidence/${consultationId}`)
      .then(r => r.json())
      .then(d => setSt(s => ({
        ...s, loading: false,
        evidence: d.evidence ?? null,
        isStale: d.isStale ?? false,
        hasTranscript: d.hasTranscript ?? false,
      })))
      .catch(() => setSt(s => ({ ...s, loading: false, error: "Не удалось загрузить данные" })));
  }, [consultationId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setSt(s => ({ ...s, generating: true, error: null }));
    try {
      const r = await fetch(`/api/evidence/${consultationId}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Ошибка генерации");
      setSt(s => ({ ...s, generating: false, evidence: d.evidence, isStale: false }));
    } catch (err) {
      setSt(s => ({
        ...s,
        generating: false,
        error: err instanceof Error ? err.message : "Ошибка",
      }));
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (st.loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Loader2 size={20} className="animate-spin" style={{ color: S.muted }} />
        <p className="text-xs" style={{ color: S.muted }}>Загрузка лупы…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (st.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle size={20} style={{ color: "#E67E22" }} />
        <p className="text-xs text-center" style={{ color: S.muted }}>{st.error}</p>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: S.border, color: S.sub, background: S.bgSub }}
        >
          Повторить
        </button>
      </div>
    );
  }

  // ── Generating ──────────────────────────────────────────────────────────────
  if (st.generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
        <div className="w-full rounded-xl border px-4 py-4 space-y-2.5" style={{ background: "#F0ECFF", borderColor: "#C4B5FD" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-700">Строю лупу…</span>
            <span className="text-xs text-violet-400">~20 сек</span>
          </div>
          <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full rounded-full bg-violet-400 animate-pulse" style={{ width: "60%" }} />
          </div>
          <p className="text-xs text-violet-500">Анализирую транскрипт на паттерны и темы…</p>
        </div>
      </div>
    );
  }

  // ── No transcript ───────────────────────────────────────────────────────────
  if (!st.hasTranscript) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <ScanSearch size={28} style={{ color: S.border }} />
        <p className="text-sm" style={{ color: S.muted }}>Нет транскрипта</p>
        <p className="text-xs text-center max-w-48" style={{ color: S.muted }}>
          Лупа работает только при наличии транскрипта консультации
        </p>
      </div>
    );
  }

  // ── No evidence yet ─────────────────────────────────────────────────────────
  if (!st.evidence) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ScanSearch size={32} style={{ color: S.border }} />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium" style={{ color: S.title }}>Лупа не построена</p>
          <p className="text-xs max-w-52 leading-relaxed" style={{ color: S.muted }}>
            Скрытый слой паттернов, цитат и тем из транскрипта
          </p>
        </div>
        <button
          onClick={generate}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ background: "#9C9289", color: "#FDFAF5", border: "1px solid #8A8079" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#8A8079"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#9C9289"; }}
        >
          <ScanSearch size={14} />
          Построить лупу
        </button>
      </div>
    );
  }

  // ── Evidence ────────────────────────────────────────────────────────────────
  const ev = st.evidence;
  const themes  = ev.repeatedThemes ?? [];
  const quotes  = ev.importantQuotes ?? [];
  const phrases = ev.repeatedPhrases ?? [];
  const markers = ev.uncertaintyMarkers;
  const offTopic = ev.possibleOffTopicAnswers ?? [];

  const hasContent = themes.length > 0 || quotes.length > 0 || phrases.length > 0 || (markers?.total ?? 0) > 0 || offTopic.length > 0;

  return (
    <div className="space-y-3">
      {/* Stale banner */}
      {st.isStale && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl"
          style={{ background: S.staleBg, border: `1px solid ${S.staleBorder}` }}
        >
          <p className="text-xs" style={{ color: S.staleText }}>Транскрипт обновился — лупа устарела</p>
          <button
            onClick={generate}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap flex-shrink-0"
            style={{ background: "#C9A96E", color: "#1A0F05" }}
          >
            <RefreshCw size={10} />
            Обновить
          </button>
        </div>
      )}

      {/* Empty content fallback */}
      {!hasContent && (
        <div
          className="rounded-xl border px-4 py-5 text-center"
          style={{ borderColor: S.border, background: S.bgSub }}
        >
          <p className="text-xs" style={{ color: S.muted }}>
            Данных не обнаружено — возможно, транскрипт слишком короткий
          </p>
        </div>
      )}

      {/* Темы */}
      {themes.length > 0 && (
        <Section icon={<Repeat2 size={13} />} title="Повторяющиеся темы" count={themes.length}>
          {themes.map((t, i) => (
            <div key={i}>
              {i > 0 && <Div />}
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Dot level={t.confidence} />
                  <span className="text-sm font-medium leading-tight flex-1" style={{ color: S.title }}>
                    {t.label}
                  </span>
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: S.bgSub, color: S.muted }}
                  >
                    ×{t.occurrences}
                  </span>
                </div>
                {t.evidence?.[0]?.quote && (
                  <p
                    className="text-xs leading-relaxed pl-3.5 border-l-2 italic"
                    style={{ color: S.muted, borderColor: S.border }}
                  >
                    «{t.evidence[0].quote}»
                  </p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Цитаты */}
      {quotes.length > 0 && (
        <Section icon={<Quote size={13} />} title="Важные цитаты" count={quotes.length}>
          {quotes.map((q, i) => (
            <div key={i}>
              {i > 0 && <Div />}
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-start gap-2">
                  <Dot level={q.confidence} />
                  <p
                    className="text-xs leading-relaxed italic flex-1"
                    style={{ color: S.title }}
                  >
                    «{q.quote}»
                  </p>
                </div>
                {q.reason && (
                  <p className="text-[11px] pl-3.5" style={{ color: S.muted }}>{q.reason}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Фразы */}
      {phrases.length > 0 && (
        <Section icon={<Repeat2 size={13} />} title="Повторяющиеся фразы" count={phrases.length} defaultOpen={false}>
          {phrases.map((p, i) => (
            <div key={i}>
              {i > 0 && <Div />}
              <div className="px-4 py-2.5 flex items-center gap-3">
                <Dot level={p.confidence} />
                <span className="text-xs font-medium flex-1" style={{ color: S.title }}>
                  «{p.phrase}»
                </span>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: S.bgSub, color: S.muted }}
                >
                  ×{p.occurrences}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Маркеры неопределённости */}
      {(markers?.total ?? 0) > 0 && (
        <Section icon={<HelpCircle size={13} />} title="Маркеры неопределённости" defaultOpen={false}>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="text-lg font-bold leading-none"
                style={{ color: S.title }}
              >
                {markers.total}
              </span>
              <span className="text-xs" style={{ color: S.muted }}>вхождений</span>
            </div>
            {markers.examples?.length > 0 && (
              <div className="space-y-1">
                {markers.examples.slice(0, 4).map((ex, i) => (
                  <p key={i} className="text-xs leading-relaxed" style={{ color: S.muted }}>
                    · «{ex.quote}»
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Уходы от темы */}
      {offTopic.length > 0 && (
        <Section icon={<Shuffle size={13} />} title="Возможные уходы от темы" count={offTopic.length} defaultOpen={false}>
          {offTopic.map((o, i) => (
            <div key={i}>
              {i > 0 && <Div />}
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-start gap-2">
                  <Dot level={o.confidence} />
                  <p className="text-xs italic flex-1" style={{ color: S.title }}>«{o.quote}»</p>
                </div>
                {o.reason && (
                  <p className="text-[11px] pl-3.5" style={{ color: S.muted }}>{o.reason}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Footer: generated at */}
      <p className="text-[11px] text-right pb-1" style={{ color: S.muted }}>
        Построено {new Date(ev.generatedAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        {" · "}
        <button
          onClick={generate}
          className="underline underline-offset-2 transition-colors"
          style={{ color: S.muted }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = S.sub; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = S.muted; }}
        >
          Перестроить
        </button>
      </p>
    </div>
  );
}
