import { NextRequest, NextResponse } from "next/server";
import { readProfile, writeProfile, clearProfile } from "@/lib/userProfileStore";

export async function GET() {
  const profile = await readProfile();
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  await writeProfile(body);
  const updated = await readProfile();
  return NextResponse.json(updated);
}

export async function DELETE() {
  await clearProfile();
  return NextResponse.json({ ok: true });
}
