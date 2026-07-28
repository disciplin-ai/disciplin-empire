import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=missing_code", requestUrl.origin)
    );
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      new URL("/auth/login?error=missing_env", requestUrl.origin)
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, {
            ...options,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            httpOnly: false,
          });
        }
      },
    },
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_failed", requestUrl.origin)
    );
  }

  return response;
}
