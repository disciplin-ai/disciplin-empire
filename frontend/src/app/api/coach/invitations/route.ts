import { NextResponse } from "next/server";
import { authenticatedCoachRequest, cleanText, coachRpcError } from "@/lib/coach/server";
import { createInvitationSecret } from "@/lib/coach/invitation";
import { deliverCoachInvitation } from "@/lib/coach/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV !== "production" ? new URL(request.url).origin : null;
}

async function recordDelivery(
  relationshipId: string,
  status: "unavailable" | "development_available" | "confirmed" | "failed",
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("coach_relationships")
    .update({ delivery_status: status, delivery_updated_at: new Date().toISOString() })
    .eq("id", relationshipId);
}

export async function POST(request: Request) {
  const auth = await authenticatedCoachRequest();
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTHENTICATION_REQUIRED",
        error: auth.error,
        retryable: false,
      },
      { status: auth.status },
    );
  }
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "resend" ? "resend" : "create";
  const secret = createInvitationSecret();
  let relationshipId = cleanText(body?.relationshipId, 80);
  let coachName = cleanText(body?.coachName, 80);
  let coachEmail = cleanText(body?.coachEmail, 254).toLowerCase();
  let athleteName = cleanText(body?.athleteName, 80);
  const academyName = cleanText(body?.academyName, 120);

  if (action === "resend") {
    const { data: relationship, error: relationshipError } = await auth.supabase
      .from("coach_relationships")
      .select("*")
      .eq("id", relationshipId)
      .eq("athlete_user_id", auth.user.id)
      .maybeSingle();
    if (relationshipError || !relationship) {
      return NextResponse.json(
        { ok: false, error: "This invitation is no longer available." },
        { status: 404 },
      );
    }
    coachName = relationship.coach_display_name;
    coachEmail = relationship.invited_email;
    athleteName = relationship.athlete_display_name;
  }

  if (!athleteName) {
    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("data")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    athleteName = cleanText(profile?.data?.name, 80) || "A Disciplin athlete";
  }

  const rpc = action === "resend"
    ? await auth.supabase.rpc("coach_resend_invitation", {
        p_relationship_id: relationshipId,
        p_token_hash: secret.tokenHash,
        p_expires_at: secret.expiresAt,
      })
    : await auth.supabase.rpc("coach_create_invitation", {
        p_athlete_display_name: athleteName,
        p_coach_display_name: coachName,
        p_coach_email: coachEmail,
        p_academy_name: academyName,
        p_token_hash: secret.tokenHash,
        p_expires_at: secret.expiresAt,
      });

  if (rpc.error) {
    const failure = coachRpcError(rpc.error);
    return NextResponse.json(
      {
        ok: false,
        code: failure.code,
        error: failure.message,
        retryable: failure.retryable,
        ...(process.env.NODE_ENV !== "production" && failure.diagnosticRef
          ? { diagnosticRef: failure.diagnosticRef }
          : {}),
      },
      { status: failure.status },
    );
  }

  relationshipId = relationshipId || String(rpc.data?.relationshipId || "");
  const origin = appOrigin(request);
  const inviteUrl = origin
    ? `${origin}/coach/invitation?token=${encodeURIComponent(secret.token)}`
    : "";
  const delivery = inviteUrl
    ? await deliverCoachInvitation({
        coachName,
        athleteName,
        inviteUrl,
        expiresAt: secret.expiresAt,
      })
    : {
        status: "unavailable" as const,
        reason: "NEXT_PUBLIC_APP_URL is not configured.",
      };

  await recordDelivery(relationshipId, delivery.status);

  return NextResponse.json({
    ok: true,
    relationshipId,
    expiresAt: secret.expiresAt,
    deliveryStatus: delivery.status,
    message:
      delivery.status === "confirmed"
        ? "Delivery confirmed"
        : delivery.status === "development_available"
          ? "Development invite available"
          : delivery.status === "unavailable"
            ? "Delivery unavailable"
            : "Delivery failed",
    ...(delivery.status === "development_available"
      ? { developmentLink: delivery.developmentLink }
      : {}),
  });
}

export async function DELETE(request: Request) {
  const auth = await authenticatedCoachRequest();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const body = await request.json().catch(() => ({}));
  const relationshipId = cleanText(body?.relationshipId, 80);
  const { error } = await auth.supabase.rpc("coach_cancel_invitation", {
    p_relationship_id: relationshipId,
  });
  if (error) {
    const failure = coachRpcError(error);
    return NextResponse.json(
      {
        ok: false,
        code: failure.code,
        error: failure.message,
        retryable: failure.retryable,
        ...(process.env.NODE_ENV !== "production" && failure.diagnosticRef
          ? { diagnosticRef: failure.diagnosticRef }
          : {}),
      },
      { status: failure.status },
    );
  }
  return NextResponse.json({ ok: true });
}
