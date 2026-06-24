import { NextRequest, NextResponse } from "next/server";
import { readProfile, writeProfile } from "@/lib/data/userProfile";

export async function GET() {
  try {
    const profile = await readProfile();
    return NextResponse.json(profile);
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Ошибка загрузки профиля" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    await writeProfile(body);
    const updated = await readProfile();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[profile PUT]", err);
    return NextResponse.json({ error: "Ошибка сохранения профиля" }, { status: 500 });
  }
}
