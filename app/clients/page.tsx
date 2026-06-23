import { clients, consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const statusLabel: Record<string, string> = {
  active: "в процессе",
  paused: "пауза",
  completed: "завершена",
};

export default function ClientsPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">

      <div className="mb-8">
        <h1 className="text-lg font-semibold text-slate-800">Клиенты</h1>
        <p className="text-sm text-slate-400 mt-0.5">{clients.filter(c => c.status === "active").length} активных терапевтических процесса</p>
      </div>

      <div className="space-y-4">
        {clients.map((client) => {
          const lastConsultation = consultations.find((c) => c.clientId === client.id);
          return (
            <Link
              key={client.id}
              href={`/client/${client.id}`}
              className="block bg-white rounded-2xl border border-slate-100 p-6 hover:border-brand-100 hover:shadow-sm transition-all group"
            >
              {/* Name row */}
              <div className="flex items-start gap-3 mb-4">
                <Avatar initials={client.initials} color={client.color} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-800">{client.name}</h2>
                    <span className="text-xs text-slate-300">{statusLabel[client.status]}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{client.totalConsultations} встреч</p>
                </div>
              </div>

              {/* Topics */}
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1.5">Темы</p>
                <div className="flex flex-wrap gap-1.5">
                  {client.mainTopics.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-full text-xs text-slate-600 bg-slate-50 border border-slate-100"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Last shift */}
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">Последний сдвиг</p>
                <p className="text-sm text-slate-600 italic leading-relaxed">{client.lastShift}</p>
              </div>

              {/* Current focus */}
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-1">Текущий фокус</p>
                <p className="text-sm text-slate-700 font-medium">{client.currentFocus}</p>
              </div>

              {/* Last session label */}
              {lastConsultation && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-transparent">
                  <span className="text-sm text-slate-500 truncate">
                    Последняя встреча: {lastConsultation.topic}
                  </span>
                  <ArrowRight size={13} className="text-slate-300 flex-shrink-0" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
