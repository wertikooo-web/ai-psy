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
import { UserPlus, Mic, ArrowRight, CheckCircle2, Clock, Users } from "lucide-react";
import { pluralMeetings } from "@/lib/format";
import { AnimatedCityScene } from "@/components/home/AnimatedCityScene";

type AnyClient       = StoredClient       & { isMock?: boolean };
type AnyConsultation = StoredConsultation & {
  isMock?: boolean; topic?: string; sessionNumber?: number; duration?: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Design tokens (same as clients page) ─────────────────────────────────────
const CARD_NORMAL = "#F3EBDD";
const CARD_HOVER  = "#D4C5B1";

// ── Shared compact card shell ─────────────────────────────────────────────────
function DashCard({ onClick, ariaLabel, children }: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={ariaLabel}
      className="w-full text-left"
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        padding:      "12px 16px",
        background:   hov ? CARD_HOVER : CARD_NORMAL,
        border:       "1px solid #CFC0A9",
        borderRadius: 14,
        boxShadow:    hov
          ? "0 2px 6px rgba(80,60,40,0.10), 0 8px 20px rgba(80,60,40,0.10)"
          : "0 1px 3px rgba(80,60,40,0.06), 0 6px 16px rgba(80,60,40,0.07)",
        transition:   "background 0.18s ease, box-shadow 0.18s ease",
        cursor:       "pointer",
      }}
    >
      {children}
      <ArrowRight
        size={14}
        style={{
          flexShrink: 0,
          color:      hov ? "#4A3C2E" : "#A8997F",
          transform:  hov ? "translateX(3px)" : "translateX(0)",
          transition: "transform 0.15s ease, color 0.15s ease",
        }}
      />
    </button>
  );
}

// ── Compact client card ───────────────────────────────────────────────────────
function DashClientCard({ client, onClick }: { client: AnyClient; onClick: () => void }) {
  return (
    <DashCard onClick={onClick} ariaLabel={`Открыть карточку клиента ${client.name}`}>
      <Avatar initials={client.initials} color={client.color} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "#3D3228" }}>
          {client.name}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "#6B5D4F" }}>
          <span className="flex items-center gap-1">
            <Users size={10} />
            {pluralMeetings(client.totalConsultations ?? 0)}
          </span>
          {client.lastConsultation && (
            <span>{formatDate(client.lastConsultation)}</span>
          )}
        </div>
      </div>
    </DashCard>
  );
}

// ── Compact consultation card ─────────────────────────────────────────────────
function DashConsultCard({ c, index, onClick }: {
  c: AnyConsultation; index: number; onClick: () => void;
}) {
  const hasAnalysis   = !!((c as StoredConsultation).analyses?.length) || c.isMock;
  const hasTranscript = !!(c as StoredConsultation).transcript?.text   || c.isMock;
  const label = c.title || c.topic || `Консультация #${c.sessionNumber ?? (index + 1)}`;

  return (
    <DashCard onClick={onClick} ariaLabel={`Открыть консультацию ${c.clientName}`}>
      <Avatar initials={c.clientInitials ?? "?"} color={c.clientColor ?? "#94a3b8"} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "#3D3228" }}>
          {c.clientName}
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "#6B5D4F" }}>
          {label}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 mr-1">
        <span className="text-xs" style={{ color: "#78716C" }}>{formatDate(c.createdAt)}</span>
        {hasAnalysis ? (
          <span className="flex items-center gap-0.5 text-xs text-emerald-600">
            <CheckCircle2 size={10} /> анализ
          </span>
        ) : hasTranscript ? (
          <span className="flex items-center gap-0.5 text-xs" style={{ color: "#78716C" }}>
            <Clock size={10} /> транскрипт
          </span>
        ) : null}
      </div>
    </DashCard>
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

  const MAX_DASHBOARD_CLIENTS       = 2;
  const MAX_DASHBOARD_CONSULTATIONS = 2;
  const recentClients       = clients.slice(0, MAX_DASHBOARD_CLIENTS);
  const recentConsultations = consultations.slice(0, MAX_DASHBOARD_CONSULTATIONS);

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

      {/* ── Single hero section — fills all available space ── */}
      <section className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatedCityScene />

        <div className="relative z-10 flex flex-col h-full">

          {/* Welcome */}
          <div className="max-w-2xl mx-auto px-6 pt-8 pb-6 text-center">
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
              Я ваш AI-помощник для работы с консультациями, транскриптами и историей клиентов
            </p>
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

          {/* Cards grid */}
          <div className="max-w-4xl mx-auto px-6 pb-6 flex-1 min-h-0 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Recent clients */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
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
                {recentClients.length === 0 ? (
                  <div
                    className="flex-1 rounded-2xl border flex items-center justify-center py-8"
                    style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#C9BBAA", fontSize: 13 }}
                  >
                    Клиентов пока нет
                  </div>
                ) : (
                  recentClients.map((client) => (
                    <DashClientCard
                      key={client.id}
                      client={client}
                      onClick={() => router.push(`/client/${client.id}`)}
                    />
                  ))
                )}
              </section>

              {/* Recent consultations */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
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
                {recentConsultations.length === 0 ? (
                  <div
                    className="flex-1 rounded-2xl border flex items-center justify-center py-8"
                    style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#C9BBAA", fontSize: 13 }}
                  >
                    Консультаций пока нет
                  </div>
                ) : (
                  recentConsultations.map((c, i) => (
                    <DashConsultCard
                      key={c.id}
                      c={c}
                      index={i}
                      onClick={() => router.push(`/consultation/${c.id}`)}
                    />
                  ))
                )}
              </section>

            </div>
          </div>

        </div>
      </section>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); loadClients(); }}
      />
    </div>
  );
}
