"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  BrainCircuit,
  Settings,
  HelpCircle,
  Mic,
} from "lucide-react";
import clsx from "clsx";
import { UploadModal } from "@/components/upload/UploadModal";
import { UserChip } from "@/components/UserChip";

const navItems = [
  { href: "/",               label: "Дашборд",      icon: LayoutDashboard },
  { href: "/clients",        label: "Клиенты",      icon: Users },
  { href: "/consultations",  label: "Консультации", icon: FileText },
];

const bottomItems = [
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/help",     label: "Помощь",    icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
    <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <BrainCircuit size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 leading-tight">TRANSCRIPT AI</div>
            <div className="text-xs text-brand-500 font-medium tracking-wider">PSY</div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-brand-50 text-brand-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}

        {/* Quick action */}
        <div className="pt-4">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Быстрые действия
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all"
          >
            <Mic size={17} />
            Загрузить запись
          </button>
        </div>
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
        {bottomItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}

        <UserChip />
      </div>
    </aside>
    <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
