import { NextRequest, NextResponse } from "next/server";
import { getAnalytics, type AnalyticsClientFilter, type AnalyticsPeriodPreset } from "@/lib/data/analytics";

const PRESETS: AnalyticsPeriodPreset[] = ["today", "week", "month", "3m", "6m", "year", "all", "custom"];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const preset = sp.get("period") as AnalyticsPeriodPreset | null;
    const client = (sp.get("client") || "all") as AnalyticsClientFilter;
    const result = await getAnalytics({
      preset: preset && PRESETS.includes(preset) ? preset : "month",
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      client,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[analytics GET]", err);
    return NextResponse.json({ error: "Не удалось загрузить аналитику" }, { status: 500 });
  }
}
