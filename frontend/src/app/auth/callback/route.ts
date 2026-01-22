// frontend/src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // If someone lands here without a code, send them to login
  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", url.origin));
  }

  // ✅ This server client MUST be the one that writes cookies via next/headers
  const sb = await supabaseServer();

  // ✅ Exchange OAuth code for a session cookie
  const { error } = await sb.auth.exchangeCodeForSession(code);

  if (error) {
    const redirectUrl = new URL("/auth/login", url.origin);
    redirectUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(redirectUrl);
  }

  // ✅ Now the cookie exists → dashboard will show user
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
