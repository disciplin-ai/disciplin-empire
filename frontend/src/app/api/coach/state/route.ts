import { NextResponse } from "next/server";
import { authenticatedCoachRequest, coachRpcError } from "@/lib/coach/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

  const { supabase, user } = auth;
  const relationshipQuery = await supabase
    .from("coach_relationships")
    .select("*")
    .or(`athlete_user_id.eq.${user.id},coach_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (relationshipQuery.error) {
    const failure = coachRpcError(relationshipQuery.error);
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

  const relationships = relationshipQuery.data ?? [];
  const relationshipIds = relationships.map((row) => row.id);
  const [submissionsQuery, versionsQuery, currentQuery, auditQuery] =
    relationshipIds.length > 0
      ? await Promise.all([
          supabase
            .from("mission_submissions")
            .select("*")
            .in("relationship_id", relationshipIds)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("mission_versions")
            .select("*")
            .in("relationship_id", relationshipIds)
            .order("approved_at", { ascending: false }),
          supabase
            .from("current_coach_missions")
            .select("*")
            .in("relationship_id", relationshipIds),
          supabase
            .from("coach_audit_events")
            .select("*")
            .in("relationship_id", relationshipIds)
            .order("created_at", { ascending: false })
            .limit(100),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  const queryError =
    submissionsQuery.error || versionsQuery.error || currentQuery.error || auditQuery.error;
  if (queryError) {
    const failure = coachRpcError(queryError);
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

  const versions = versionsQuery.data ?? [];
  const ownCurrentPointer = (currentQuery.data ?? []).find(
    (row) => row.athlete_user_id === user.id,
  );
  const currentMission = ownCurrentPointer
    ? versions.find((version) => version.id === ownCurrentPointer.mission_version_id) ?? null
    : null;

  return NextResponse.json(
    {
      ok: true,
      state: {
        userId: user.id,
        athleteRelationship:
          relationships.find(
            (row) =>
              row.athlete_user_id === user.id &&
              (row.status === "invited" || row.status === "connected"),
          ) ?? null,
        coachedRelationships: relationships.filter(
          (row) => row.coach_user_id === user.id && row.status === "connected",
        ),
        submissions: submissionsQuery.data ?? [],
        versions,
        currentMission,
        auditEvents: auditQuery.data ?? [],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
