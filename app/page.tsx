"use client";

import { useState, useEffect } from "react";
import { clients as mockClients, consultations } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import { AddClientModal } from "@/components/client/AddClientModal";
import Link from "next/link";
import { Mic, Search, ArrowRight, Clock, UserPlus } from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface DisplayClient {
  id: string;
  name: string;
  initials: string;
  color: string;
  totalConsultations: number;
  lastConsultation: string;
  currentFocus: string;
  isReal?: boolean;
}

export default function DashboardPage() {
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [addOpen, setAddOpen]         = useState(false);
  const [query, setQuery]             = useState("");
  const [realClients, setRealClients] = useState<StoredClient[]>([]);

  async function loadClients() {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) setRealClients(await res.json());
    } catch {}
  }

  useEffect(() => { loadClients(); }, []);

  const mockActive  = mockClients.filter((c) => c.status === "active");
  const allClients: DisplayClient[] = [
    ...realClients.map((c) => ({ ...c, isReal: true })),
    ...mockActive.map((c) => ({ ...c, isReal: false })),
  ];

  const filtered = query.trim()
    ? allClients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : allClients;

  const recent = consultations.slice(0, 5);

  return (
    <>
      <div className="p-8 max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Добрый день, Наталья</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-brand-200 hover:bg-brand-50 text-slate-600 hover:text-brand-600 text-sm font-medium rounded-xl transition-colors"
            >
              <UserPlus size={14} />
              Новый клиент
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              <Mic size={14} />
              Загрузить запись
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти клиента..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 transition-all"
          />
        </div>

        {/* Clients */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {query ? "Результат поиска" : "Активные клиенты"}
          </h2>

          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">Не найдено</p>
          )}

          <div className="space-y-2">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/client/${client.id}`}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-100 hover:border-brand-100 hover:shadow-sm transition-all group"
              >
                <Avatar initials={client.initials} color={client.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-800">{client.name}</span>
                    {client.currentFocus && (
                      <span className="text-xs text-slate-400 truncate hidden sm:block">
                        {client.currentFocus}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {client.totalConsultations} встреч · последняя {formatDate(client.lastConsultation)}
                  </p>
                </div>
                <ArrowRight size={14} className="text-slate-200 group-hover:text-brand-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* Latest consultations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Последние консультации
            </h2>
            <Link href="/consultations" className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              Все →
            </Link>
          </div>

          <div className="space-y-1">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/consultation/${c.id}`}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
              >
                <Avatar initials={c.clientInitials} color={c.clientColor} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700">{c.clientName}</span>
                  <span className="text-slate-300 mx-1.5">·</span>
                  <span className="text-sm text-slate-400 truncate">{c.topic}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300 flex-shrink-0">
                  <Clock size={11} />
                  {formatDate(c.date)}
                </div>
                <ArrowRight size={13} className="text-slate-200 group-hover:text-brand-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>

      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={loadClients}
      />
    </>
  );
}
