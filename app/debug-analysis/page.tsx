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
  modes:   { display: "flex", gap: 8, flexWrap: "wrap" },
  input:   { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, color: "#1e293b", boxSizing: "border-box" },
  ta:      { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, color: "#1e293b", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" },
  btn:     { width: "100%", padding: "12px", background: "#3a5ff8", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 16 },
  btnOff:  { width: "100%", padding: "12px", background: "#cbd5e1", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "not-allowed", marginTop: 16 },
  pre:     { background: "#f8fafc", borderRadius: 10, padding: 16, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 280, color: "#334155", margin: 0 },
  grid:    { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 },
  stat:    { background: "#f8fafc", borderRadius: 12, padding: "12px 8px", textAlign: "center" },
  statV:   { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  statL:   { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  fRow:    { display: "flex", alignItems: "center", gap: 8, padding: "5px 0" },
  fIdx:    { fontSize: 11, color: "#cbd5e1", width: 20, textAlign: "right" },
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
  const [mode, setMode]         = useState<Mode>("working");
  const [transcript, setTr]     = useState(SAMPLE);
  const [ctx, setCtx]           = useState("38 лет. 3-я сессия. Тревога.");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<DebugResult | null>(null);
  const [fetchErr, setFetchErr] = useState("");

  useEffect(() => { console.log("[debug-analysis] mounted"); }, []);

  async function runDebug() {
    console.log("[debug-analysis] BUTTON CLICK — mode:", mode);
    setLoading(true);
    setResult(null);
    setFetchErr("");
    try {
      console.log("[debug-analysis] API REQUEST → /api/debug-analysis");
      const res = await fetch("/api/debug-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, provider: "openai", transcript, clientContext: ctx }),
      });
      console.log("[debug-analysis] API STATUS:", res.status);
      const data: DebugResult = await res.json();
      console.log("[debug-analysis] API RESPONSE:", data);
      setResult(data);
    } catch (e) {
      console.error("[debug-analysis] FETCH ERROR:", e);
      setFetchErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={P.page}>
      <h1 style={P.h1}>Debug: Сборка промпта</h1>
      <p style={P.sub}>Проверяет базу знаний — без вызова OpenAI</p>

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

      {/* Inputs */}
      <div style={P.card}>
        <label style={P.lbl}>Контекст клиента</label>
        <input style={P.input} value={ctx} onChange={(e) => setCtx(e.target.value)} />

        <label style={P.lbl2}>Транскрипт</label>
        <textarea style={P.ta} rows={5} value={transcript} onChange={(e) => setTr(e.target.value)} />

        <button style={loading ? P.btnOff : P.btn} onClick={runDebug} disabled={loading}>
          {loading ? "Собираю промпт..." : "Проверить сборку промпта"}
        </button>
      </div>

      {/* Fetch error */}
      {fetchErr && (
        <div style={P.errCard}>
          <strong style={{ color: "#b91c1c" }}>Ошибка fetch:</strong>
          <pre style={{ ...P.pre, marginTop: 8 }}>{fetchErr}</pre>
        </div>
      )}

      {/* Results */}
      {result && (
        result.error ? (
          <div style={P.errCard}>
            <strong style={{ color: "#b91c1c" }}>Ошибка API:</strong>
            <pre style={{ ...P.pre, marginTop: 8 }}>{result.error}</pre>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={P.card}>
              <div style={P.grid}>
                <div style={P.stat}><div style={P.statV}>{result.mode}</div><div style={P.statL}>Режим</div></div>
                <div style={P.stat}><div style={P.statV}>{result.usedFiles.length}</div><div style={P.statL}>Файлов</div></div>
                <div style={P.stat}><div style={P.statV}>{result.promptLength.toLocaleString("ru")}</div><div style={P.statL}>Символов</div></div>
                <div style={P.stat}><div style={P.statV}>{Math.round(result.promptLength / 4).toLocaleString("ru")}</div><div style={P.statL}>Токенов ~</div></div>
              </div>
              <span style={tagStyle(result.coreIsFirst)}>
                {result.coreIsFirst ? "✅ CORE первый" : "❌ CORE не первый"}
              </span>
              <span style={tagStyle(result.missingFiles.length === 0)}>
                {result.missingFiles.length === 0 ? "✅ Все файлы найдены" : `❌ Нет: ${result.missingFiles.join(", ")}`}
              </span>
            </div>

            {/* File order */}
            <div style={P.card}>
              <label style={P.lbl}>Порядок файлов</label>
              {result.usedFiles.map((f, i) => (
                <div key={f} style={P.fRow}>
                  <span style={P.fIdx}>{i + 1}.</span>
                  <span style={fileTagStyle(i === 0)}>{f}</span>
                  {i === 0 && <span style={{ fontSize: 11, color: "#d97706" }}>← core</span>}
                </div>
              ))}
            </div>

            {/* Prompt preview */}
            <div style={P.card}>
              <label style={P.lbl}>Первые 1500 символов промпта</label>
              <pre style={P.pre}>{result.promptPreview}</pre>
            </div>

            {/* Mock response */}
            <div style={P.card}>
              <label style={P.lbl}>Mock response</label>
              <code style={{ fontSize: 12, color: "#64748b" }}>{result.mockResponse}</code>
            </div>
          </>
        )
      )}
    </div>
  );
}
