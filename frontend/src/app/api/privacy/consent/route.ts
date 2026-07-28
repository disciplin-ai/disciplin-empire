import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logServerError, requestId, safeServerError } from "@/lib/security/responses";

export async function POST(req: Request) {
  const id = requestId(req);
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const consentType = String(body?.consentType || "").trim();
  const granted = body?.granted === true;

  if (!consentType) {
    return NextResponse.json(
      { error: "Missing consent type" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("user_consents").insert({
    user_id: user.id,
    consent_type: consentType,
    consent_version: "v1",
    granted,
  });

  if (error) {
    logServerError("privacy-consent", id);
    return safeServerError(id);
  }

  return NextResponse.json({ ok: true });
}
