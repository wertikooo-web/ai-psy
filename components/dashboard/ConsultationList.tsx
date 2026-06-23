import Link from "next/link";
import { consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Clock } from "lucide-react";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function ConsultationList() {
  const recent = consultations.slice(0, 4);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Последние консультации</h2>
        <Link href="/consultations" className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1">
          Все <ArrowRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {recent.map((c) => (
          <Link
            key={c.id}
            href={`/consultation/${c.id}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
          >
            <Avatar initials={c.clientInitials} color={c.clientColor} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 truncate">{c.clientName}</span>
                <span className="text-xs text-slate-300">#{c.sessionNumber}</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{c.topic}</p>
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              <Badge variant={c.status} />
              <div className="flex items-center justify-end gap-1 text-xs text-slate-300">
                <Clock size={10} />
                {c.duration}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
