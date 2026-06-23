"use client";

import { useState, useEffect } from "react";
import type React from "react";

type Mode = "working" | "deep" | "therapist_process" | "gestalt";

interface DebugResult {
  mode: string;
  provider: string;
  usedFiles: string[];
  missingFiles: string[];
  coreIsFirst: boolean;
  promptLength: number;
  promptPreview: string;
  mockResponse: string;
  error?: string;
}

interface AnalysisResult {
  analysis: string;
  usedFiles: string[];
  provider: string;
  model: string;
  promptTokens: number;
  error?: string;
}

const MODES: { value: Mode; label: string }[] = [
  { value: "working",           label: "Рабочий" },
  { value: "deep",              label: "Глубокий" },
  { value: "therapist_process", label: "Процесс психолога" },
  { value: "gestalt",           label: "Гештальт" },
];

const SAMPLE = "Клиент: Устала быть сильной.\nПсихолог: Расскажи подробнее.\nКлиент: Не просить помощи. Справляться самой.";

// ── Styles ────────────────────────────────────────────────────────────────────

const P: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 760, margin: "0 auto", padding: "40px 20px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#94a3b8", marginBottom: 32 },
  lbl:     { fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 },
  lbl2:    { fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8, marginTop: 16 },
  card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 16 },
  errCard: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, padding: 24, marginBottom: 16 },
  modes:   { display: "flex", gap: 8, flexWrap: "wrap" as const },
  input:   { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, color: "#1e293b", boxSizing: "border-box" as const },
  ta:      { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, color: "#1e293b", resize: "vertical" as const, fontFamily: "monospace", boxSizing: "border-box" as const },
  btnRow:  { display: "flex", gap: 12, marginTop: 16 },
  btn:     { flex: 1, padding: "12px", background: "#3a5ff8", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btn2:    { flex: 1, padding: "12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnOff:  { flex: 1, padding: "12px", background: "#cbd5e1", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "not-allowed" },
  pre:     { background: "#f8fafc", borderRadius: 10, padding: 16, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap" as const, overflowY: "auto" as const, maxHeight: 280, color: "#334155", margin: 0 },
  preAI:   { background: "#f0fdf4", borderRadius: 10, padding: 16, fontSize: 13, whiteSpace: "pre-wrap" as const, overflowY: "auto" as const, maxHeight: 500, color: "#14532d", margin: 0, lineHeight: 1.6 },
  grid:    { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  grid3:   { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 },
  stat:    { background: "#f8fafc", borderRadius: 12, padding: "12px 8px", textAlign: "center" as const },
  statG:   { background: "#f0fdf4", borderRadius: 12, padding: "12px 8px", textAlign: "center" as const },
  statV:   { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  statVG:  { fontSize: 18, fontWeight: 700, color: "#16a34a" },
  statL:   { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  fRow:    { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  fIdx:    { fontSize: 11, color: "#cbd5e1", width: 20, textAlign: "right" as const },
  divider: { borderTop: "2px solid #e2e8f0", margin: "32px 0", display: "flex", alignItems: "center", justifyContent: "center" },
  divLbl:  { background: "#f8fafc", padding: "4px 16px", fontSize: 12, fontWeight: 600, color: "#94a3b8", borderRadius: 20, marginTop: -14 },
};

function modeBtn(active: boolean): React.CSSProperties {
  return { padding: "6px 16px", borderRadius: 10, border: "1px solid", borderColor: active ? "#3a5ff8" : "#e2e8f0", background: active ? "#3a5ff8" : "#fff", color: active ? "#fff" : "#475569", fontWeight: 500, fontSize: 13, cursor: "pointer" };
}
function tagStyle(ok: boolean): React.CSSProperties {
  return { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, marginRight: 8, background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#14532d" : "#7f1d1d" };
}
function fileTagStyle(first: boolean): React.CSSProperties {
  return { fontSize: 11, fontFamily: "monospace", padding: "2px 8px", borderRadius: 6, background: first ? "#fef9c3" : "#f1f5f9", color: first ? "#854d0e" : "#475569", border: first ? "1px solid #fde68a" : "1px solid #e2e8f0" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DebugAnalysisPage() {
  const [mode, setMode]           = useState<Mode>("working");
  const [transcript, setTr]       = useState(SAMPLE);
  const [ctx, setCtx]             = useState("38 лет. 3-я сессия. Тревога.");

  const [loadingDebug, setLoadingDebug]   = useState(false);
  const [debugResult, setDebugResult]     = useState<DebugResult | null>(null);
  const [debugErr, setDebugErr]           = useState("");

  const [loadingAI, setLoadingAI]         = useState(false);
  const [aiResult, setAIResult]           = useState<AnalysisResult | null>(null);
  const [aiErr, setAIErr]                 = useState("");

  useEffect(() => { console.log("[debug-analysis] mounted"); }, []);

  async function runDebug() {
    setLoadingDebug(true);
    setDebugResult(null);
    setDebugErr("");
    try {
      const res = await fetch("/api/debug-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, provider: "openai", transcript, clientContext: ctx }),
      });
      setDebugResult(await res.json());
    } catch (e) {
      setDebugErr(String(e));
    } finally {
      setLoadingDebug(false);
    }
  }

  async function runAI() {
    setLoadingAI(true);
    setAIResult(null);
    setAIErr("");
    try {
      const res = await fetch("/api/analyze-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, provider: "openai", transcript, clientContext: ctx }),
      });
      const data: AnalysisResult = await res.json();
      setAIResult(data);
    } catch (e) {
      setAIErr(String(e));
    } finally {
      setLoadingAI(false);
    }
  }

  const busy = loadingDebug || loadingAI;

  return (
    <div style={P.page}>
      <h1 style={P.h1}>Debug: Анализ</h1>
      <p style={P.sub}>Проверка базы знаний и реального вызова OpenAI</p>

      {/* Mode selector */}
      <div style={P.card}>
        <label style={P.lbl}>Режим анализа</label>
        <div style={P.modes}>
          {MODES.map((m) => (
            <button key={m.value} style={modeBtn(mode === m.value)} onClick={() => setMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs + buttons */}
      <div style={P.card}>
        <label style={P.lbl}>Контекст клиента</label>
        <input style={P.input} value={ctx} onChange={(e) => setCtx(e.target.value)} />

        <label style={P.lbl2}>Транскрипт</label>
        <textarea style={P.ta} rows={5} value={transcript} onChange={(e) => setTr(e.target.value)} />

        <div style={P.btnRow}>
          <button style={busy ? P.btnOff : P.btn} onClick={runDebug} disabled={busy}>
            {loadingDebug ? "Собираю промпт..." : "Проверить сборку промпта"}
          </button>
          <button style={busy ? P.btnOff : P.btn2} onClick={runAI} disabled={busy}>
            {loadingAI ? "Запрос к OpenAI..." : "Запустить реальный анализ"}
          </button>
        </div>
      </div>

      {/* ── SECTION: Debug result ───────────────────────────────────────── */}
      {debugErr && (
        <div style={P.errCard}>
          <strong style={{ color: "#b91c1c" }}>Ошибка fetch:</strong>
          <pre style={{ ...P.pre, marginTop: 8 }}>{debugErr}</pre>
        </div>
      )}

      {debugResult && (
        debugResult.error ? (
          <div style={P.errCard}>
            <strong style={{ color: "#b91c1c" }}>Ошибка debug API:</strong>
            <pre style={{ ...P.pre, marginTop: 8 }}>{debugResult.error}</pre>
          </div>
        ) : (
          <>
            <div style={P.card}>
              <div style={P.grid}>
                <div style={P.stat}><div style={P.statV}>{debugResult.mode}</div><div style={P.statL}>Режим</div></div>
                <div style={P.stat}><div style={P.statV}>{debugResult.usedFiles.length}</div><div style={P.statL}>Файлов</div></div>
                <div style={P.stat}><div style={P.statV}>{debugResult.promptLength.toLocaleString("ru")}</div><div style={P.statL}>Символов</div></div>
                <div style={P.stat}><div style={P.statV}>{Math.round(debugResult.promptLength / 4).toLocaleString("ru")}</div><div style={P.statL}>Токенов ~</div></div>
              </div>
              <span style={tagStyle(debugResult.coreIsFirst)}>
                {debugResult.coreIsFirst ? "✅ CORE первый" : "❌ CORE не первый"}
              </span>
              <span style={tagStyle(debugResult.missingFiles.length === 0)}>
                {debugResult.missingFiles.length === 0 ? "✅ Все файлы найдены" : `❌ Нет: ${debugResult.missingFiles.join(", ")}`}
              </span>
            </div>

            <div style={P.card}>
              <label style={P.lbl}>Порядок файлов</label>
              {debugResult.usedFiles.map((f, i) => (
                <div key={f} style={P.fRow}>
                  <span style={P.fIdx}>{i + 1}.</span>
                  <span style={fileTagStyle(i === 0)}>{f}</span>
                  {i === 0 && <span style={{ fontSize: 11, color: "#d97706" }}>← core</span>}
                </div>
              ))}
            </div>

            <div style={P.card}>
              <label style={P.lbl}>Первые 1500 символов промпта</label>
              <pre style={P.pre}>{debugResult.promptPreview}</pre>
            </div>
          </>
        )
      )}

      {/* ── SECTION: Real AI result ─────────────────────────────────────── */}
      {aiErr && (
        <div style={P.errCard}>
          <strong style={{ color: "#b91c1c" }}>Ошибка AI:</strong>
          <pre style={{ ...P.pre, marginTop: 8 }}>{aiErr}</pre>
        </div>
      )}

      {aiResult && (
        aiResult.error ? (
          <div style={P.errCard}>
            <strong style={{ color: "#b91c1c" }}>Ошибка OpenAI:</strong>
            <pre style={{ ...P.pre, marginTop: 8 }}>{aiResult.error}</pre>
          </div>
        ) : (
          <>
            <div style={{ ...P.divider }}>
              <div style={P.divLbl}>Результат OpenAI</div>
            </div>

            <div style={P.card}>
              <div style={P.grid3}>
                <div style={P.statG}><div style={P.statVG}>{aiResult.provider}</div><div style={P.statL}>Provider</div></div>
                <div style={P.statG}><div style={P.statVG}>{aiResult.model ?? "gpt-4o"}</div><div style={P.statL}>Model</div></div>
                <div style={P.statG}><div style={P.statVG}>{aiResult.promptTokens?.toLocaleString("ru") ?? "—"}</div><div style={P.statL}>Prompt tokens</div></div>
              </div>

              <label style={P.lbl}>Файлы базы знаний ({aiResult.usedFiles.length})</label>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 16 }}>
                {aiResult.usedFiles.map((f, i) => (
                  <span key={f} style={fileTagStyle(i === 0)}>{f}</span>
                ))}
              </div>

              <label style={P.lbl}>Анализ</label>
              <pre style={P.preAI}>{aiResult.analysis}</pre>
            </div>
          </>
        )
      )}
    </div>
  );
}
