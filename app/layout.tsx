import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "TRANSCRIPT AI · PSY",
  description: "Платформа для психологов — транскрипция и AI-анализ консультаций",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="text-slate-800 antialiased" style={{ background: "#FDFCFA" }}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col min-h-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
