"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Eye } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ObservationModal } from "@/components/observation/ObservationModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [observationOpen, setObservationOpen] = useState(false);
  const [tooltip,         setTooltip]         = useState(false);

  const onConsultation = pathname.startsWith("/consultation/");

  // Auto-detect current client from URL: /client/[id]
  const clientMatch     = pathname.match(/^\/client\/([^/]+)/);
  const currentClientId = clientMatch?.[1] ?? undefined;

  // Auto-detect consultation ID from URL: /consultation/[id]
  const consultMatch       = pathname.match(/^\/consultation\/([^/]+)/);
  const currentConsultationId = consultMatch?.[1] ?? undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* position:relative + zIndex:10 ensures sidebar paints above the city actor
          overlay (position:fixed zIndex:1 at document.body level) */}
      <div style={{ position:"relative", zIndex:10, flexShrink:0 }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative" style={{ zIndex:10 }}>
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
        <div
          className="fixed right-6 z-40"
          style={{ bottom: onConsultation ? "90px" : "24px" }}
        >
          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute right-0 bottom-[calc(100%+10px)] rounded-xl px-3 py-2 text-xs shadow-lg whitespace-nowrap pointer-events-none"
              style={{
                background:  "#3D3228",
                color:       "#FDFAF5",
                border:      "1px solid #2A221A",
                maxWidth:    260,
                whiteSpace:  "normal",
                textAlign:   "right",
                lineHeight:  "1.4",
              }}
            >
              <p className="font-medium">Добавить наблюдение</p>
              <p className="opacity-75 mt-0.5">Для голосовой диктовки используйте Win + H</p>
            </div>
          )}

          <button
            onClick={() => setObservationOpen(true)}
            onMouseEnter={() => setTooltip(true)}
            onMouseLeave={() => setTooltip(false)}
            className="flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{
              width:        56,
              height:       56,
              borderRadius: "50%",
              background:   "white",
              border:       "2.5px solid #D8CFBE",
              boxShadow:    "0 4px 16px rgba(0,0,0,0.15)",
            }}
            aria-label="Добавить наблюдение"
            onMouseDown={(e)  => { e.currentTarget.style.background = "#EDE7DA"; e.currentTarget.style.borderColor = "#A8997F"; }}
            onMouseUp={(e)    => { e.currentTarget.style.background = "white";    e.currentTarget.style.borderColor = "#D8CFBE"; }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 36, height: 36, background: "#4A3C2E" }}
            >
              <Eye size={18} color="white" />
            </div>
          </button>
        </div>
      </main>

      {observationOpen && (
        <ObservationModal
          onClose={() => setObservationOpen(false)}
          defaultClientId={currentClientId}
          consultationId={currentConsultationId}
        />
      )}
    </div>
  );
}
