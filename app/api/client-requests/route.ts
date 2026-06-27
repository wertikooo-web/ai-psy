import { NextResponse } from "next/server";
import { getAllCurrentRequests } from "@/lib/data/clientRequests";

// GET /api/client-requests → { [clientId]: text } map of all current requests
export async function GET() {
  try {
    const map = await getAllCurrentRequests();
    return NextResponse.json(map);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
