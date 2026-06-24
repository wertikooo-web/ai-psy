"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clients as mockClients } from "@/lib/mockData";
import { consultations as mockConsultations } from "@/lib/mockData";
import type { StoredClient } from "@/lib/clientStore";
import type { StoredConsultation } from "@/lib/consultationStore";
import { Avatar } from "@/components/ui/Avatar";
import { UploadModal } from "@/components/upload/UploadModal";
import { AddClientModal } from "@/components/client/AddClientModal";
import { UserPlus, Mic, ArrowRight, CheckCircle2, Clock } from "lucide-react";

type AnyClient       = StoredClient       & { isMock?: boolean };
type AnyConsultation = StoredConsultation & {
  isMock?: boolean; topic?: string; sessionNumber?: number; duration?: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Subtle SVG background ──────────────────────────────────────────────────────
function BackgroundIllustration() {
  return (
    <svg
      aria-hidden
      className="absolute bottom-0 left-0 w-full pointer-events-none select-none"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMax meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Flowing contour lines */}
      <path d="M0,200 C150,160 300,240 500,190 C700,140 850,220 1000,180 C1100,160 1150,170 1200,165" fill="none" stroke="#DDD4C6" strokeWidth="1.2" opacity="0.6" />
      <path d="M0,230 C200,195 350,265 550,215 C750,165 900,240 1100,205 C1150,195 1180,200 1200,198" fill="none" stroke="#DDD4C6" strokeWidth="0.8" opacity="0.45" />
      <path d="M0,260 C250,225 400,285 600,245 C800,205 950,265 1200,235" fill="none" stroke="#DDD4C6" strokeWidth="0.6" opacity="0.3" />
      <path d="M0,285 C300,260 500,300 750,270 C950,245 1100,280 1200,265" fill="none" stroke="#DDD4C6" strokeWidth="0.5" opacity="0.2" />

      {/* Scattered dots — neural/constellation feel */}
      {[
        [120, 175], [280, 215], [430, 155], [590, 200], [740, 168],
        [880, 210], [1020, 178], [1140, 195],
        [60,  240], [200, 270], [370, 250], [520, 280], [680, 255],
        [830, 275], [970, 258], [1110, 272],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="#C9BBAA" opacity="0.35" />
      ))}

      {/* Light connecting lines between some dots */}
      <line x1="120" y1="175" x2="280" y2="215" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="280" y1="215" x2="430" y2="155" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="430" y1="155" x2="590" y2="200" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="590" y1="200" x2="740" y2="168" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="740" y1="168" x2="880" y2="210" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="880" y1="210" x2="1020" y2="178" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
      <line x1="1020" y1="178" x2="1140" y2="195" stroke="#C9BBAA" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [addOpen,      setAddOpen]      = useState(false);
  const [greeting,     setGreeting]     = useState("Психолог");
  const [photoUrl,     setPhotoUrl]     = useState("");
  const [initials,     setInitials]     = useState("П");
  const [clients,      setClients]      = useState<AnyClient[]>([]);
  const [consultations, setConsultations] = useState<AnyConsultation[]>([]);

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

  async function loadConsultations() {
    try {
      const res  = await fetch("/api/consultations");
      const real: StoredConsultation[] = res.ok ? await res.json() : [];
      const realIds = new Set(real.map((c) => c.id));
      const mock = mockConsultations
        .filter((m) => !realIds.has(m.id))
        .map((m) => ({
          id: m.id, clientId: m.clientId, clientName: m.clientName,
          clientInitials: m.clientInitials, clientColor: m.clientColor,
          title: m.topic, createdAt: m.date,
          source: "audio" as const, status: "done" as const,
          topic: m.topic, sessionNumber: m.sessionNumber,
          duration: m.duration, isMock: true,
        } as AnyConsultation));
      const all = [...real, ...mock];
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setConsultations(all);
    } catch {
      setConsultations([]);
    }
  }

  useEffect(() => {
    loadClients();
    loadConsultations();
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        const name = p.displayName?.trim() || [p.firstName, p.lastName].filter(Boolean).join(" ");
        if (name) setGreeting(name);
        if (p.photoUrl) setPhotoUrl(p.photoUrl);
        const f = p.firstName?.[0]?.toUpperCase() ?? "";
        const l = p.lastName?.[0]?.toUpperCase()  ?? "";
        setInitials(f && l ? f + l : f || (p.displayName?.[0]?.toUpperCase() ?? "П"));
      })
      .catch(() => {});
  }, []);

  const recentClients       = clients.slice(0, 4);
  const recentConsultations = consultations.slice(0, 3);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto relative" style={{ background: "#FDFCFA" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-6 pt-10 lg:pt-[10vh] pb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          {photoUrl ? (
            <img src={photoUrl} alt={greeting}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              style={{ border: "2px solid #E8E0D0" }} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0"
              style={{ border: "2px solid #E8E0D0" }}>
              {initials}
            </div>
          )}
          <h1 className="text-2xl font-bold" style={{ color: "#3D3228" }}>
            Добро пожаловать, {greeting}
          </h1>
        </div>
        <p className="text-sm leading-relaxed mb-7" style={{ color: "#A8997F" }}>
          AI-помощник для работы с консультациями, транскриптами и историей клиентов
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border"
            style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#F0EBE1"; }}
          >
            <UserPlus size={15} />
            Новый клиент
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Mic size={15} />
            Загрузить запись
          </button>
        </div>
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent clients */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>
                Последние клиенты
              </h2>
              <button
                onClick={() => router.push("/clients")}
                className="text-xs font-medium transition-colors flex items-center gap-1"
                style={{ color: "#C9BBAA" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#6B5D4F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#C9BBAA"; }}
              >
                Все клиенты <ArrowRight size={12} />
              </button>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
              {recentClients.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: "#C9BBAA" }}>
                  Клиентов пока нет
                </div>
              ) : (
                recentClients.map((client, i) => (
                  <button
                    key={client.id}
                    onClick={() => router.push(`/client/${client.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors group"
                    style={{
                      borderTop: i > 0 ? "1px solid #E4DDD0" : undefined,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#EAE3D6"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Avatar initials={client.initials} color={client.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "#3D3228" }}>{client.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#A8997F" }}>
                        {client.totalConsultations} встреч
                        {client.lastConsultation && ` · ${formatDate(client.lastConsultation)}`}
                      </div>
                    </div>
                    <ArrowRight size={13} style={{ color: "#C9BBAA", flexShrink: 0 }} />
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Recent consultations */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>
                Последние консультации
              </h2>
              <button
                onClick={() => router.push("/consultations")}
                className="text-xs font-medium transition-colors flex items-center gap-1"
                style={{ color: "#C9BBAA" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#6B5D4F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#C9BBAA"; }}
              >
                Все консультации <ArrowRight size={12} />
              </button>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
              {recentConsultations.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: "#C9BBAA" }}>
                  Консультаций пока нет
                </div>
              ) : (
                recentConsultations.map((c, i) => {
                  const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;
                  const hasTranscript = !!(c as StoredConsultation).transcript?.text   || c.isMock;
                  const label = c.title || c.topic || `Консультация #${c.sessionNumber ?? (i + 1)}`;
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/consultation/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{ borderTop: i > 0 ? "1px solid #E4DDD0" : undefined }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#EAE3D6"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Avatar initials={c.clientInitials ?? "?"} color={c.clientColor ?? "#94a3b8"} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: "#3D3228" }}>{c.clientName}</div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "#A8997F" }}>{label}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs" style={{ color: "#C9BBAA" }}>{formatDate(c.createdAt)}</span>
                        {hasAnalysis ? (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                            <CheckCircle2 size={10} /> анализ
                          </span>
                        ) : hasTranscript ? (
                          <span className="flex items-center gap-0.5 text-xs" style={{ color: "#A8997F" }}>
                            <Clock size={10} /> транскрипт
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Background illustration ───────────────────────────────────────── */}
      <div className="relative h-32 overflow-hidden pointer-events-none select-none" aria-hidden>
        <BackgroundIllustration />
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); loadClients(); }}
      />
    </div>
  );
}
