import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("privacy_requests").insert({
    user_id: user.id,
    request_type: "delete_account",
    status: "received",
    notes:
      "User requested deletion. Manual admin review required before permanent deletion.",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Deletion request received. Account deletion should be reviewed and completed by an admin.",
  });
}