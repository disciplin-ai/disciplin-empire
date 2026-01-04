"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type OAuthProvider = "google" | "apple";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [emailLoading, setEmailLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---------- Email / password login ----------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setEmailLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setEmailLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.push("/dashboard");
  };

  // ---------- OAuth (Google / Apple) ----------

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setErrorMsg(null);
    setOauthLoading(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // where Supabase should send you back after auth
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : undefined,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-2">
          Sign in to DISCIPLIN
        </h1>
        <p className="text-xs text-white/50 mb-6">
          Use the same email you’ll use for Sensei AI and Fuel AI. This links
          your camp identity.
        </p>

        {/* OAuth */}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={oauthLoading !== null}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-white text-slate-900 text-sm py-2.5 hover:bg-slate-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {oauthLoading === "google" ? "Connecting…" : "Continue with Google"}
          </button>

          <button
            type="button"
            onClick={() => handleOAuthSignIn("apple")}
            disabled={oauthLoading !== null}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-black text-white text-sm py-2.5 border border-white/15 hover:bg-black/80 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {oauthLoading === "apple" ? "Connecting…" : "Continue with Apple"}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            or sign in with email
          </span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-white/60" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-md bg-slate-950/70 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-teal-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@camp.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/60" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                className="w-full rounded-md bg-slate-950/70 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-teal-300 pr-16"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-2 px-2 text-[11px] text-white/60 hover:text-white transition"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={emailLoading || oauthLoading !== null}
            className="w-full mt-2 rounded-md bg-teal-400 text-slate-950 text-sm font-semibold py-2.5 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-teal-300 transition"
          >
            {emailLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-white/40">
          Don’t have an account yet? You can create one from your first camp
          invite, or directly in Supabase while you’re testing.
        </p>
      </div>
    </div>
  );
}
