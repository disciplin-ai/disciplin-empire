// src/app/api/startTrial/route.ts
import { NextResponse } from "next/server";

function removed() {
  return NextResponse.json(
    { ok: false, error: "Trial activation is not available." },
    { status: 410 },
  );
}

export const POST = removed;
export const GET = removed;
