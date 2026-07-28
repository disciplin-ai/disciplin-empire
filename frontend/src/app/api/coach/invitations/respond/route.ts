import { NextResponse } from "next/server";
import { authenticatedCoachRequest, coachRpcError } from "@/lib/coach/server";
import { hashInvitationSecret, isPlausibleInvitationSecret } from "@/lib/coach/invitation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticatedCoachRequest();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const body = await request.json().catch(() => ({}));
  if (!isPlausibleInvitationSecret(body?.token)) {
    return NextResponse.json({ ok: false, error: "This invitation is invalid." }, { status: 400 });
  }
  const action =
    body?.action === "accept" || body?.action === "decline" || body?.action === "resolve"
      ? body.action
      : null;
  if (!action) {
    return NextResponse.json({ ok: false, error: "Choose an invitation action." }, { status: 400 });
  }
  const rpcName =
    action === "accept"
      ? "coach_accept_invitation"
      : action === "decline"
        ? "coach_decline_invitation"
        : "coach_resolve_invitation";
  const { data, error } = await auth.supabase.rpc(rpcName, {
    p_token_hash: hashInvitationSecret(body.token),
  });
  if (error) {
    const failure = coachRpcError(error);
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, invitation: data ?? null });
}

