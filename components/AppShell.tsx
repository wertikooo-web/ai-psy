"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden absolute top-4 left-4 z-30 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border transition-colors"
          style={{ background: "#F0EBE1", borderColor: "#D8CFBE", color: "#6B5D4F" }}
          aria-label="Открыть меню"
        >
          <Menu size={18} />
        </button>

        {/* Offset for mobile hamburger button */}
        <div className="lg:hidden h-14 flex-shrink-0" />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
