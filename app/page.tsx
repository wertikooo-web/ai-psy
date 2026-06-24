"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clients as mockClients } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import { AddClientModal } from "@/components/client/AddClientModal";
import { UserPlus, Mic, Users, ArrowRight } from "lucide-react";

type AnyClient = StoredClient & { isMock?: boolean };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function HomePage() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen]       = useState(false);
  const [greeting, setGreeting]     = useState("Психолог");
  const [clients, setClients]       = useState<AnyClient[]>([]);

  async function loadClients() {
    try {
      const res  = await fetch("/api/clients");
      const real: StoredClient[] = res.ok ? await res.json() : [];
      const realIds = new Set(real.map((c) => c.id));
      setClients([
        ...real,
        ...mockClients.filter((m) => !realIds.has(m.id)).map((m) => ({ ...m, isMock: true } as AnyClient)),
      ]);
    } catch {
      setClients(mockClients.map((m) => ({ ...m, isMock: true } as AnyClient)));
    }
  }

  useEffect(() => {
    loadClients();
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        const name = p.displayName?.trim() || [p.firstName, p.lastName].filter(Boolean).join(" ");
        if (name) setGreeting(name);
      })
      .catch(() => {});
  }, []);

  const recent = clients.slice(0, 4);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Hero section */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)" }}
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Decorative soft circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-100/30 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-emerald-100/30 blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-8 py-16 text-center">
          {/* Logo mark */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8 border border-slate-200/60 shadow-sm">
            <div className="w-5 h-5 rounded bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">Ψ</span>
            </div>
            <span className="text-xs font-semibold text-slate-600 tracking-wide">TRANSCRIPT AI · PSY</span>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            Добро пожаловать, {greeting}
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-10 max-w-lg mx-auto">
            AI-помощник для работы с консультациями,<br />транскриптами и историей клиентов.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 text-slate-600 text-sm font-medium transition-all shadow-sm"
            >
              <UserPlus size={16} />
              Новый клиент
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Mic size={16} />
              Загрузить запись
            </button>
            <button
              onClick={() => router.push("/clients")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-slate-600 text-sm font-medium transition-all shadow-sm"
            >
              <Users size={16} />
              Все клиенты
            </button>
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Последние клиенты
          </h2>
          <button
            onClick={() => router.push("/clients")}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            Все клиенты →
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Клиентов пока нет. Создайте первого клиента.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recent.map((client) => (
              <button
                key={client.id}
                onClick={() => router.push(`/client/${client.id}`)}
                className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 hover:border-brand-100 hover:shadow-sm transition-all text-left group"
              >
                <Avatar initials={client.initials} color={client.color} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{client.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {client.totalConsultations} встреч
                    {client.lastConsultation && ` · ${formatDate(client.lastConsultation)}`}
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-200 group-hover:text-brand-400 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); loadClients(); }} />
    </div>
  );
}
