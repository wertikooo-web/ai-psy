"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Eye } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ObservationModal } from "@/components/observation/ObservationModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [observationOpen,  setObservationOpen]  = useState(false);

  const onConsultation = pathname.startsWith("/consultation/");

  // Auto-detect current client from URL: /client/[id]
  const clientMatch     = pathname.match(/^\/client\/([^/]+)/);
  const currentClientId = clientMatch?.[1] ?? undefined;

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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Observation FAB */}
        <button
          onClick={() => setObservationOpen(true)}
          title="Добавить наблюдение по клиенту"
          className="fixed right-6 z-40 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 group"
          style={{
            width:        56,
            height:       56,
            borderRadius: "50%",
            bottom:       onConsultation ? "90px" : "24px",
            background:   "white",
            border:       "2.5px solid #D8CFBE",
            boxShadow:    "0 4px 16px rgba(0,0,0,0.15)",
          }}
          aria-label="Добавить наблюдение по клиенту"
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6B5D4F"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D8CFBE"; }}
          onMouseDown={(e)  => { e.currentTarget.style.background = "#EDE7DA"; e.currentTarget.style.borderColor = "#A8997F"; }}
          onMouseUp={(e)    => { e.currentTarget.style.background = "white";    e.currentTarget.style.borderColor = "#D8CFBE"; }}
        >
          <div
            className="flex items-center justify-center rounded-full transition-colors"
            style={{ width: 36, height: 36, background: "#4A3C2E" }}
          >
            <Eye size={18} color="white" />
          </div>
        </button>
      </main>

      {observationOpen && (
        <ObservationModal
          onClose={() => setObservationOpen(false)}
          defaultClientId={currentClientId}
        />
      )}
    </div>
  );
}
