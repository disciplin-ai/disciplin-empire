"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Mode = "signup" | "signin";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [mode, setMode] = useState<Mode>(
    (searchParams.get("mode") as Mode) || "signup"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // ✅ Only show error if Supabase sent one (not because "code" is missing)
  const oauthError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("message");

  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Enter an email and password.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setLocalError(err?.message || "Auth failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    try {
      setLoading(true);

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // ✅ MUST point to your callback route
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) throw error;
      // Note: browser will redirect to Google automatically
    } catch (err: any) {
      setLocalError(err?.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl shadow-black/40">
        <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">
          DISCIPLIN OS
        </p>

        <h1 className="mt-3 text-2xl font-semibold">
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>

        {(oauthError || localError) && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {localError || oauthError}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm font-semibold hover:border-emerald-500/60 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email
            </label>
            <input
              className="w-full rounded-xl bg-slate-950/40 border border-slate-800 px-4 py-3 text-sm outline-none focus:border-emerald-500/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Password
            </label>
            <input
              className="w-full rounded-xl bg-slate-950/40 border border-slate-800 px-4 py-3 text-sm outline-none focus:border-emerald-500/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="hover:text-emerald-300"
          >
            {mode === "signup"
              ? "Have an account? Sign in"
              : "No account? Create one"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="hover:text-emerald-300"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
