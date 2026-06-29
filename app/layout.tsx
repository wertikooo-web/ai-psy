import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "TRANSCRIPT AI · PSY",
  description: "Платформа для психологов — транскрипция и AI-анализ консультаций",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("app_sidebar_mode")?.value;
  const initialMode = (raw === "full" || raw === "decorative" || raw === "hidden") ? raw : "full";

  return (
    <html lang="ru">
      <body className="text-slate-800 antialiased" style={{ background: "#FBF8F5" }}>
        <AppShell initialSidebarMode={initialMode}>{children}</AppShell>
      </body>
    </html>
  );
}
