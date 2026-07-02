"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, BookOpen, MoreHorizontal } from "lucide-react";

const ITEMS = [
  { href: "/",              label: "Главная",      icon: Home,      exact: true  },
  { href: "/clients",       label: "Клиенты",      icon: Users,     exact: false },
  { href: "/consultations", label: "Консультации", icon: FileText,  exact: false },
  { href: "/notebook",      label: "Блокнот",      icon: BookOpen,  exact: false },
];

export function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t"
      style={{
        background: "#F7F7F8",
        borderColor: "#E5E5E5",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2"
            style={{ color: active ? "#3a5ff8" : "#9CA3AF" }}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
          </Link>
        );
      })}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center gap-0.5 py-2"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
      >
        <MoreHorizontal size={21} strokeWidth={1.8} />
        <span style={{ fontSize: 10 }}>Ещё</span>
      </button>
    </nav>
  );
}
