// app/api/analytics/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Analytics is not available." },
    { status: 410 },
  );
}
