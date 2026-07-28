import { NextResponse } from "next/server";
import { authenticatedCoachRequest, cleanText, coachRpcError } from "@/lib/coach/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticatedCoachRequest();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const body = await request.json().catch(() => ({}));
  const { error } = await auth.supabase.rpc("coach_disconnect_relationship", {
    p_relationship_id: cleanText(body?.relationshipId, 80),
  });
  if (error) {
    const failure = coachRpcError(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

