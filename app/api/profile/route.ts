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
    const msg = err instanceof Error ? err.message : "Ошибка сохранения профиля";
    console.error("[profile PUT]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Clears profile fields without deleting the row (upserts blank values)
export async function DELETE() {
  try {
    await writeProfile({
      firstName: "", lastName: "", displayName: "",
      specialization: "", approach: "", email: "", photoUrl: "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка очистки профиля";
    console.error("[profile DELETE]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
