import Link from "next/link";
import { clients } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight } from "lucide-react";

export function ClientList() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Клиенты</h2>
        <Link href="/clients" className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1">
          Все <ArrowRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {clients.slice(0, 4).map((client) => (
          <Link
            key={client.id}
            href={`/clients`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
          >
            <Avatar initials={client.initials} color={client.color} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 truncate">{client.name}</span>
                <Badge variant={client.status} />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{client.concern}</p>
            </div>
            <span className="text-xs text-slate-300 flex-shrink-0">{client.totalConsultations} сес.</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
