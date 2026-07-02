"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Users, FileText, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";

type SClient       = { id: string; name: string; status: string };
type SConsultation = { id: string; title: string; clientName: string; date: string };
type SNotebook     = { id: string; text: string; clientName?: string; date: string };

type Results = {
  clients:       SClient[];
  consultations: SConsultation[];
  notebook:      SNotebook[];
};

interface GlobalSearchProps {
  open:    boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState<Results | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset & focus on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(null);
    setFocusedIdx(-1);
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults(null); setLoading(false); return; }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as Results;
        setResults(data);
        setFocusedIdx(-1);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Build flat list for keyboard nav
  const flat: Array<{ key: string; href: string }> = [];
  if (results) {
    results.clients.forEach((c)       => flat.push({ key: `c-${c.id}`,   href: `/client/${c.id}` }));
    results.consultations.forEach((c) => flat.push({ key: `con-${c.id}`, href: `/consultation/${c.id}` }));
    results.notebook.forEach((n)      => flat.push({ key: `n-${n.id}`,   href: `/notebook` }));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((p) => Math.min(p + 1, flat.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocusedIdx((p) => Math.max(p - 1, -1)); return; }
    if (e.key === "Enter" && focusedIdx >= 0) {
      e.preventDefault();
      const item = flat[focusedIdx];
      if (item) { window.location.href = item.href; onClose(); }
    }
  }

  if (!open) return null;

  const hasResults = flat.length > 0;
  const noResults  = results !== null && flat.length === 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "min(14vh, 110px)", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxWidth: 560, background: "#FAFAF9", border: "1px solid #E5E5E5" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Input row ── */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: "1px solid #EFEFEF", minHeight: 54 }}
        >
          {loading
            ? <Loader2 size={17} className="animate-spin flex-shrink-0" style={{ color: "#B0A090" }} />
            : <Search size={17} className="flex-shrink-0" style={{ color: "#B0A090" }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по клиентам, консультациям, заметкам..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 14, color: "#111827", padding: "0" }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="flex-shrink-0 rounded-md p-0.5 transition-colors"
              style={{ color: "#B0A090" }}
            >
              <X size={15} />
            </button>
          )}
          <kbd
            className="hidden sm:inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono flex-shrink-0"
            style={{ background: "#F0EDE8", color: "#9C8E80", border: "1px solid #E0D8CE" }}
          >
            Esc
          </kbd>
        </div>

        {/* ── Results ── */}
        {(hasResults || noResults) && (
          <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
            {noResults && (
              <p className="py-8 text-center text-sm" style={{ color: "#9CA3AF" }}>
                Ничего не найдено
              </p>
            )}

            {results && results.clients.length > 0 && (
              <Group label="Клиенты" Icon={Users}>
                {results.clients.map((c) => {
                  const idx = flat.findIndex((f) => f.key === `c-${c.id}`);
                  return (
                    <ResultItem
                      key={c.id}
                      href={`/client/${c.id}`}
                      label={c.name}
                      sub={c.status === "active" ? "Активный" : "Архив"}
                      focused={focusedIdx === idx}
                      onHover={() => setFocusedIdx(idx)}
                      onClose={onClose}
                    />
                  );
                })}
              </Group>
            )}

            {results && results.consultations.length > 0 && (
              <Group label="Консультации" Icon={FileText}>
                {results.consultations.map((c) => {
                  const idx = flat.findIndex((f) => f.key === `con-${c.id}`);
                  return (
                    <ResultItem
                      key={c.id}
                      href={`/consultation/${c.id}`}
                      label={c.title}
                      sub={[c.clientName, c.date].filter(Boolean).join(" · ")}
                      focused={focusedIdx === idx}
                      onHover={() => setFocusedIdx(idx)}
                      onClose={onClose}
                    />
                  );
                })}
              </Group>
            )}

            {results && results.notebook.length > 0 && (
              <Group label="Блокнот" Icon={BookOpen}>
                {results.notebook.map((n) => {
                  const idx = flat.findIndex((f) => f.key === `n-${n.id}`);
                  return (
                    <ResultItem
                      key={n.id}
                      href="/notebook"
                      label={n.text || "Заметка"}
                      sub={[n.clientName, n.date].filter(Boolean).join(" · ")}
                      focused={focusedIdx === idx}
                      onHover={() => setFocusedIdx(idx)}
                      onClose={onClose}
                    />
                  );
                })}
              </Group>
            )}
          </div>
        )}

        {/* ── Empty state / quick links ── */}
        {!query && (
          <div className="px-4 py-3 flex flex-wrap gap-2" style={{ borderTop: results ? "1px solid #F0EDE8" : "none" }}>
            <QuickLink href="/clients"       label="Клиенты"      />
            <QuickLink href="/consultations" label="Консультации" />
            <QuickLink href="/notebook"      label="Блокнот"      />
            <QuickLink href="/payments"      label="Оплаты"       />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Group({
  label, Icon, children,
}: { label: string; Icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div
        className="flex items-center gap-1.5 px-4 pt-3 pb-1"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#B0A090", textTransform: "uppercase" }}
      >
        <Icon size={11} />
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultItem({
  href, label, sub, focused, onHover, onClose,
}: { href: string; label: string; sub?: string; focused: boolean; onHover: () => void; onClose: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      onMouseEnter={onHover}
      className="flex flex-col px-4 py-2.5 transition-colors"
      style={{
        background: focused ? "#F0EDE8" : "transparent",
        borderRadius: 0,
        textDecoration: "none",
      }}
    >
      <span className="text-sm font-medium truncate" style={{ color: "#111827" }}>
        {label}
      </span>
      {sub && (
        <span className="text-xs truncate mt-0.5" style={{ color: "#9CA3AF" }}>
          {sub}
        </span>
      )}
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      style={{ background: "#F0EDE8", color: "#7B6A58", border: "1px solid #E8E0D4" }}
    >
      {label}
    </Link>
  );
}
