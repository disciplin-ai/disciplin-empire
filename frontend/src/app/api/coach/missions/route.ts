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
  const { data, error } = await auth.supabase.rpc("coach_submit_mission", {
    p_relationship_id: cleanText(body?.relationshipId, 80),
    p_correction_text: cleanText(body?.correction, 2000),
    p_practice_task: cleanText(body?.practiceTask, 2000),
    p_athlete_context: cleanText(body?.athleteContext, 2000) || null,
    p_proposed_change_to_version_id:
      cleanText(body?.proposedChangeToVersionId, 80) || null,
  });
  if (error) {
    const failure = coachRpcError(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, submission: data });
}

