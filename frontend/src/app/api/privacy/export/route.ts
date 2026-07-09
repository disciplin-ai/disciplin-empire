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

  const [consents, privacyRequests] = await Promise.all([
    supabase.from("user_consents").select("*").eq("user_id", user.id),
    supabase.from("privacy_requests").select("*").eq("user_id", user.id),
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
    note:
      "This export includes compliance-layer records. Add app-specific tables here as Disciplin expands.",
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="disciplin-data-export.json"`,
    },
  });
}