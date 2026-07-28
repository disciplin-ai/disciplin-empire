import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await createSupabaseServerClient();

  const origin = url.origin;
  const redirectTo = `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
  }

  // Supabase returns the Google consent URL
  return NextResponse.redirect(data.url);
}
