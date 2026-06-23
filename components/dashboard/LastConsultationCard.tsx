import Link from "next/link";
import { consultations } from "@/lib/mockData";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Clock, FileText, MessageSquare, Sparkles } from "lucide-react";

export function LastConsultationCard() {
  const c = consultations[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Последняя консультация</h2>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar initials={c.clientInitials} color={c.clientColor} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">{c.clientName}</span>
              <Badge variant={c.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{c.topic}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span>Сессия #{c.sessionNumber}</span>
              <span className="flex items-center gap-1"><Clock size={11} />{c.duration}</span>
              <span>{new Date(c.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 mb-4">
          {c.summary}
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-blue-50">
            <FileText size={14} className="text-brand-400 mx-auto mb-1" />
            <div className="text-xs font-medium text-slate-600">{c.transcript.length}</div>
            <div className="text-xs text-slate-400">реплик</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-emerald-50">
            <Sparkles size={14} className="text-emerald-500 mx-auto mb-1" />
            <div className="text-xs font-medium text-slate-600">{c.analysis.length}</div>
            <div className="text-xs text-slate-400">блоков AI</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-indigo-50">
            <MessageSquare size={14} className="text-indigo-400 mx-auto mb-1" />
            <div className="text-xs font-medium text-slate-600">{c.chat.length}</div>
            <div className="text-xs text-slate-400">сообщений</div>
          </div>
        </div>

        <Link
          href={`/consultation/${c.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        >
          Открыть консультацию <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
