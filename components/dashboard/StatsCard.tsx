import { ReactNode } from "react";
import clsx from "clsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color?: "blue" | "green" | "amber" | "purple";
}

const colors = {
  blue:   { bg: "bg-blue-50",   icon: "text-brand-500",  ring: "ring-blue-100" },
  green:  { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100" },
  amber:  { bg: "bg-amber-50",  icon: "text-amber-600",  ring: "ring-amber-100" },
  purple: { bg: "bg-indigo-50", icon: "text-indigo-600", ring: "ring-indigo-100" },
};

export function StatsCard({ title, value, sub, icon, color = "blue" }: StatsCardProps) {
  const c = colors[color];
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center ring-4", c.bg, c.ring)}>
          <span className={c.icon}>{icon}</span>
        </div>
      </div>
    </div>
  );
}
