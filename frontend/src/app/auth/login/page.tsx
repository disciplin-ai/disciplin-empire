// src/app/auth/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingEmail(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoadingEmail(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoadingGoogle(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });

    setLoadingGoogle(false);

    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 border border-slate-800 px-8 py-10 shadow-xl">
        <h1 className="text-xl font-semibold">Sign in to DISCIPLIN</h1>
        <p className="mt-2 text-sm text-slate-400">
          Use the same email you’ll use for Sensei AI and Fuel AI. This links
          your camp identity.
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          className="mt-6 w-full rounded-lg bg-slate-100 text-slate-900 py-2 text-sm font-medium hover:bg-white transition disabled:opacity-60"
        >
          {loadingGoogle ? "Connecting…" : "Continue with Google"}
        </button>

        <button
          disabled
          className="mt-2 w-full rounded-lg bg-slate-800 text-slate-400 py-2 text-sm font-medium cursor-not-allowed"
        >
          Apple login coming later
        </button>

        <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <span>OR SIGN IN WITH EMAIL</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">
              Email
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-400"
              placeholder="you@camp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">
              Password
            </label>
            <div className="mt-1 flex items-center rounded-lg bg-slate-950 border border-slate-800 px-3">
              <input
                type={showPassword ? "text" : "password"}
                className="flex-1 bg-transparent py-2 text-sm outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-500/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loadingEmail}
            className="mt-2 w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-60"
          >
            {loadingEmail ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          Don’t have an account yet? You can create one while you’re testing
          directly from Supabase.
        </p>
      </div>
    </div>
  );
}
