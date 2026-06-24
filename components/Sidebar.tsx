"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  FileText,
  BookOpen,
  Bot,
  Settings,
  HelpCircle,
  BrainCircuit,
  Mic,
} from "lucide-react";
import clsx from "clsx";
import { UploadModal } from "@/components/upload/UploadModal";
import { UserChip } from "@/components/UserChip";

const mainNav = [
  { href: "/",              label: "Главная",      icon: Home },
  { href: "/clients",       label: "Клиенты",      icon: Users },
  { href: "/consultations", label: "Консультации", icon: FileText },
];

const toolsNav = [
  { href: "/knowledge-base", label: "База знаний", icon: BookOpen },
  { href: "/psy-gpts",       label: "PSY-GPTs",    icon: Bot },
];

const systemNav = [
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/help",     label: "Помощь",    icon: HelpCircle },
];

function NavGroup({ label, items }: { label: string; items: typeof mainNav }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="px-3 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </div>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
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
            <Icon size={16} />
            {itemLabel}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <Link href="/" className="px-5 py-5 border-b border-slate-100 flex items-center gap-2.5 hover:bg-slate-50 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
            <BrainCircuit size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 leading-tight">TRANSCRIPT AI</div>
            <div className="text-xs text-brand-500 font-medium tracking-wider">PSY</div>
          </div>
        </Link>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto">
          <NavGroup label="Основное" items={mainNav} />
          <NavGroup label="Инструменты" items={toolsNav} />
        </nav>

        {/* Upload quick action */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setUploadOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-brand-50 hover:text-brand-600 border border-dashed border-slate-200 hover:border-brand-200 transition-all"
          >
            <Mic size={16} />
            Загрузить запись
          </button>
        </div>

        {/* System + User */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-0.5">
          {systemNav.map(({ href, label, icon: Icon }) => {
            return (
              <NavLink key={href} href={href} label={label} icon={Icon} />
            );
          })}
          <UserChip />
        </div>
      </aside>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-brand-50 text-brand-600"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}
