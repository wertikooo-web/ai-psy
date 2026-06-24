"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

// ── Craft palette (consistent with clients page) ──────────────────────────────
const S = {
  bg:     "#FBF8F2",
  border: "#D8CFBE",
  tag:    "#E9DCC7",
  tagBdr: "#D0C8B8",
  title:  "#6B5D4F",
};

interface MockSession {
  id: string;
  clientMap?: {
    dynamics: { label: string; direction: "up" | "down" }[];
  };
}

interface OverviewClient {
  mainTopics?: string[];
  lastShift?: string;
  currentFocus?: string;
}

interface Props {
  client: OverviewClient;
  mockSessions?: MockSession[];
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border" style={{ background: S.bg, borderColor: S.border }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: S.border, background: "#E9DCC7" }}>
        <h3 className="text-sm font-bold" style={{ color: "#3A2E22" }}>{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function OverviewTab({ client, mockSessions = [] }: Props) {
  const dynamics = mockSessions.find((s) => s.clientMap)?.clientMap?.dynamics ?? [];
  const hasContent =
    (client.mainTopics?.length ?? 0) > 0 ||
    client.lastShift ||
    client.currentFocus ||
    dynamics.length > 0;

  if (!hasContent) {
    return (
      <div className="py-10 text-center text-stone-400 text-sm">
        Обзор пополнится после первых консультаций
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(client.mainTopics?.length ?? 0) > 0 && (
        <SectionBlock title="Повторяющиеся темы">
          <div className="flex flex-wrap gap-2">
            {client.mainTopics!.map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-full text-sm text-stone-700"
                style={{ background: S.tag, border: `1px solid ${S.tagBdr}` }}
              >
                {t}
              </span>
            ))}
          </div>
        </SectionBlock>
      )}

      {client.lastShift && (
        <SectionBlock title="Последний значимый сдвиг">
          <p className="text-sm text-stone-700 leading-relaxed italic">{client.lastShift}</p>
        </SectionBlock>
      )}

      {client.currentFocus && (
        <SectionBlock title="Текущий фокус">
          <p className="text-sm font-medium text-slate-700">{client.currentFocus}</p>
        </SectionBlock>
      )}

      {dynamics.length > 0 && (
        <SectionBlock title="Динамика терапии">
          <div className="flex flex-wrap gap-2">
            {dynamics.map((d) => (
              <span
                key={d.label}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${
                  d.direction === "up"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-600 border-rose-100"
                }`}
              >
                {d.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {d.label}
              </span>
            ))}
          </div>
        </SectionBlock>
      )}
    </div>
  );
}
