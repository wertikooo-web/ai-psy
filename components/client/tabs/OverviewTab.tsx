"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { ClientHistoryItem } from "@/lib/types";

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

export function OverviewTab({ client, mockSessions = [] }: Props) {
  const dynamics = mockSessions.find((s) => s.clientMap)?.clientMap?.dynamics ?? [];
  const hasContent = (client.mainTopics?.length ?? 0) > 0 || client.lastShift || client.currentFocus || dynamics.length > 0;

  if (!hasContent) {
    return (
      <div className="py-10 text-center text-slate-400 text-sm">
        Обзор пополнится после первых консультаций
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
      {(client.mainTopics?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Повторяющиеся темы терапии
          </p>
          <div className="flex flex-wrap gap-2">
            {client.mainTopics!.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full text-sm text-slate-600 bg-slate-50 border border-slate-100">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {client.lastShift && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Последний значимый сдвиг
          </p>
          <p className="text-sm text-slate-600 leading-relaxed italic">{client.lastShift}</p>
        </div>
      )}

      {client.currentFocus && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Текущий фокус
          </p>
          <p className="text-sm font-medium text-slate-700">{client.currentFocus}</p>
        </div>
      )}

      {dynamics.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Динамика терапии
          </p>
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
        </div>
      )}
    </div>
  );
}
