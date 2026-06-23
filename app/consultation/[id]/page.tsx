import { notFound } from "next/navigation";
import { consultations } from "@/lib/mockData";
import { getConsultation } from "@/lib/consultationStore";
import { ConsultationClient } from "@/components/consultation/ConsultationClient";
import { RealConsultationView } from "@/components/consultation/RealConsultationView";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConsultationPage({ params }: Props) {
  const { id } = await params;

  // 1. Try mock data first
  const mock = consultations.find((c) => c.id === id);
  if (mock) {
    const formattedDate = new Date(mock.date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="flex flex-col h-screen">
        <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-shrink-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={15} />
            Назад
          </Link>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar initials={mock.clientInitials} color={mock.clientColor} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">{mock.clientName}</span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-500">Сессия #{mock.sessionNumber}</span>
                <Badge variant={mock.status} />
              </div>
              <p className="text-xs text-slate-400 truncate">{mock.topic}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {mock.duration}
            </span>
            <span>{formattedDate}</span>
          </div>
        </header>

        <ConsultationClient consultation={mock} />
      </div>
    );
  }

  // 2. Fallback: real consultation from local JSON store
  const real = await getConsultation(id);
  if (!real) notFound();

  return <RealConsultationView consultation={real} />;
}
