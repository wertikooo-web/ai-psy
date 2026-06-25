import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "TRANSCRIPT AI · PSY",
  description: "Платформа для психологов — транскрипция и AI-анализ консультаций",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="text-slate-800 antialiased" style={{ background: "#F5F0E8" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
