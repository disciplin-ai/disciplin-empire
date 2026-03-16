import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  console.log("[auth callback] hit");
  console.log("[auth callback] url:", request.url);

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    console.log("[auth callback] missing code");
    return NextResponse.redirect(
      new URL("/auth/login?error=missing_code", requestUrl.origin)
    );
  }

  const response = NextResponse.redirect(
    new URL("/dashboard", requestUrl.origin)
  );

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  console.log("[auth callback] env url exists:", !!supabaseUrl);
  console.log("[auth callback] env key exists:", !!supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("[auth callback] missing env");
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
        console.log("[auth callback] setting cookies:", cookiesToSet.map((c) => c.name));
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  console.log("[auth callback] exchange error:", error?.message ?? null);

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_failed", requestUrl.origin)
    );
  }

  console.log("[auth callback] success, redirecting to /dashboard");
  return response;
}