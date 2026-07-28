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
  const decision =
    body?.decision === "approve" ||
    body?.decision === "edit_and_approve" ||
    body?.decision === "reject"
      ? body.decision
      : "";
  const { data, error } = await auth.supabase.rpc("coach_decide_submission", {
    p_submission_id: cleanText(body?.submissionId, 80),
    p_decision: decision,
    p_correction_text: cleanText(body?.correction, 2000) || null,
    p_practice_task: cleanText(body?.practiceTask, 2000) || null,
    p_athlete_context: cleanText(body?.athleteContext, 2000) || null,
    p_rejection_reason: cleanText(body?.rejectionReason, 1000) || null,
  });
  if (error) {
    const failure = coachRpcError(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, decision: data });
}

