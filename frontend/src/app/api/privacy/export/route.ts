import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    consents,
    privacyRequests,
    coachRelationships,
    missionSubmissions,
    missionVersions,
    coachAuditEvents,
  ] = await Promise.all([
    supabase.from("user_consents").select("*").eq("user_id", user.id),
    supabase.from("privacy_requests").select("*").eq("user_id", user.id),
    supabase
      .from("coach_relationships")
      .select("*")
      .or(`athlete_user_id.eq.${user.id},coach_user_id.eq.${user.id}`),
    supabase
      .from("mission_submissions")
      .select("*")
      .eq("athlete_user_id", user.id),
    supabase
      .from("mission_versions")
      .select("*")
      .or(`athlete_user_id.eq.${user.id},coach_user_id.eq.${user.id}`),
    supabase
      .from("coach_audit_events")
      .select("*")
      .eq("actor_user_id", user.id),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    consents: consents.data || [],
    privacyRequests: privacyRequests.data || [],
    coachRelationships: coachRelationships.data || [],
    missionSubmissions: missionSubmissions.data || [],
    missionVersions: missionVersions.data || [],
    coachAuditEvents: coachAuditEvents.data || [],
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="disciplin-data-export.json"`,
    },
  });
}
