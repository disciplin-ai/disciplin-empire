"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useProfile } from "@/components/ProfileProvider";
import { accountResolutionLabel } from "@/lib/auth/accountResolution";

type AuthPhase = "idle" | "authenticating" | "confirmed" | "loading_profile";

function safeNext(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.26-.2-1.82H12v3.43h5.52a4.72 4.72 0 0 1-2.05 3.1l-.02.11 2.98 2.3.2.02c1.83-1.7 2.97-4.18 2.97-7.14Z"/><path fill="#34A853" d="M12 22c2.69 0 4.94-.89 6.59-2.43l-3.16-2.43c-.85.57-1.99.97-3.43.97a5.96 5.96 0 0 1-5.64-4.12l-.1.01-3.1 2.4-.04.1A9.96 9.96 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.36 13.99A6.16 6.16 0 0 1 6.03 12c0-.7.12-1.38.32-1.99v-.12L3.2 7.45l-.1.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.08 4.5l3.28-2.51Z"/><path fill="#EA4335" d="M12 5.89c1.87 0 3.13.8 3.85 1.46l2.8-2.73C16.93 3.02 14.69 2 12 2a9.96 9.96 0 0 0-8.89 5.5l3.24 2.51A5.98 5.98 0 0 1 12 5.9Z"/></svg>;
}

function SessionTransition({ phase, label }: { phase: AuthPhase; label: string }) {
  if (phase !== "confirmed" && phase !== "loading_profile") return null;
  return <motion.div role="status" aria-live="polite" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-30 grid place-items-center bg-[#030811]/94 px-6 backdrop-blur-xl"><div className="w-full max-w-sm text-center"><div className="mx-auto h-9 w-9 rounded-full border border-emerald-300/30 bg-emerald-300/10 p-2"><motion.div className="h-full w-full rounded-full border-2 border-emerald-200/25 border-t-emerald-200" animate={{rotate:360}} transition={{duration:.8,repeat:Infinity,ease:"linear"}}/></div><p className="mt-5 app-label text-emerald-200/75">Account confirmed</p><h2 className="mt-2 app-title-card">{label}</h2><p className="mt-2 app-body-secondary">Your account state has been resolved securely.</p></div></motion.div>;
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const { user, loading, profile } = useProfile();
  const mode = params.get("mode") === "signup" ? "signup" : "signin";
  const next = safeNext(params.get("next"), mode === "signup" ? "/onboarding" : "/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{email?: string; password?: string}>({});
  const pending = phase === "authenticating" || phase === "confirmed" || phase === "loading_profile";
  const displayedPhase: AuthPhase = !loading && user ? "loading_profile" : phase;
  const resolvedAccountLabel = accountResolutionLabel(profile as Record<string, unknown> | null);

  useEffect(() => {
    if (loading || !user) return;
    const timer = window.setTimeout(() => {
      router.replace(next);
      router.refresh();
    }, reduceMotion ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [loading, user, next, router, reduceMotion]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const nextFieldErrors: {email?: string; password?: string} = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) nextFieldErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextFieldErrors.email = "Enter a valid email address.";
    if (!password) nextFieldErrors.password = "Enter your password.";
    else if (mode === "signup" && password.length < 12) nextFieldErrors.password = "Use at least 12 characters.";
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }
    setFieldErrors({});
    setPhase("authenticating"); setError(null); setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (signUpError) { setError("Unable to create the account. Try again or use sign in."); setPhase("idle"); return; }
        if (!data.session) { setNotice("Check your email to confirm your account. This setup will continue after confirmation."); setPhase("idle"); return; }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) { setError("Unable to sign in. Check your details or try again later."); setPhase("idle"); return; }
      }
      setPhase("confirmed");
    } catch {
      setError(mode === "signup" ? "Account creation failed. Check your connection and try again." : "Sign in failed. Check your details and try again.");
      setPhase("idle");
    }
  }

  async function google() {
    if (pending) return;
    setPhase("authenticating"); setError(null); setNotice(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (oauthError) { setError("Unable to continue with Google. Try again later."); setPhase("idle"); }
  }

  if (loading) return <main className="app-canvas grid place-items-center text-sm text-white/45" aria-busy="true"><div className="app-surface flex w-[min(90vw,360px)] items-center gap-3 p-5"><span className="app-skeleton h-3 w-3 shrink-0 rounded-full"/><span>Checking your session…</span></div></main>;

  return <main className="app-canvas px-5 py-5 sm:px-7">
    <AnimatePresence><SessionTransition phase={displayedPhase} label={resolvedAccountLabel}/></AnimatePresence>
    <header className="relative mx-auto flex max-w-5xl items-center justify-between py-2"><Link href="/" className="app-brand">DISCIPLIN</Link><Link href="/plans" className="app-button-quiet min-h-9 text-xs">View plans</Link></header>
    <section className="relative mx-auto grid min-h-[calc(100dvh-72px)] max-w-5xl items-center gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <motion.div initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduceMotion?0:.24,ease:[.22,1,.36,1]}} className="hidden lg:block"><p className="app-label text-emerald-200/65">One continuous workflow</p><h1 className="mt-4 max-w-lg app-title-display">Carry each session forward.</h1><p className="mt-5 max-w-md app-body-secondary">Disciplin connects evidence, coaching authority, preparation, and today’s work without assuming who is signing in.</p></motion.div>
      <motion.div key={mode} initial={reduceMotion?false:{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{duration:reduceMotion?0:.22,ease:[.22,1,.36,1]}} className="app-card p-5 sm:p-7">
        <p className="app-label">{mode === "signup" ? "Create account" : "Sign in"}</p><h2 className="mt-2 app-title-section">{mode === "signup" ? "Set up your Disciplin account." : "Welcome back."}</h2><p className="mt-2 app-body-secondary">{mode === "signup" ? "Your setup progress will be saved to this account." : "Sign in to continue to Disciplin."}</p>
        <button type="button" onClick={() => void google()} disabled={pending} aria-busy={phase === "authenticating"} className="app-button-oauth mt-6 w-full"><GoogleMark/><span>{phase === "authenticating" ? "Connecting…" : "Continue with Google"}</span></button>
        <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.14em] text-white/25"><span className="h-px flex-1 bg-white/[0.07]"/>or email<span className="h-px flex-1 bg-white/[0.07]"/></div>
        <form onSubmit={submit} noValidate className="space-y-4"><label className="block"><span className="text-xs font-medium text-white/65">Email</span><input type="email" required autoComplete="email" value={email} onChange={(event)=>{setEmail(event.target.value);if(fieldErrors.email)setFieldErrors(current=>({...current,email:undefined}));}} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email?"email-error":undefined} className="app-input mt-2 aria-[invalid=true]:border-rose-300/55 aria-[invalid=true]:focus:ring-rose-300/[.08]"/>{fieldErrors.email?<span id="email-error" className="mt-1.5 block text-xs text-rose-200" role="alert">{fieldErrors.email}</span>:null}</label><label className="block"><span className="text-xs font-medium text-white/65">Password</span><span className="relative mt-2 block"><input type={showPassword ? "text" : "password"} required minLength={mode === "signup" ? 12 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event)=>{setPassword(event.target.value);if(fieldErrors.password)setFieldErrors(current=>({...current,password:undefined}));}} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password?"password-error":undefined} className="app-input pr-12 aria-[invalid=true]:border-rose-300/55 aria-[invalid=true]:focus:ring-rose-300/[.08]"/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-xl text-white/40 transition duration-150 hover:bg-white/[.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></span>{fieldErrors.password?<span id="password-error" className="mt-1.5 block text-xs text-rose-200" role="alert">{fieldErrors.password}</span>:null}</label>
          <AnimatePresence initial={false}>{error?<motion.p initial={{opacity:0,y:-3}} animate={{opacity:1,y:0}} role="alert" className="border-l-2 border-rose-300 bg-rose-300/[0.04] px-3 py-2 text-sm text-rose-100">{error}</motion.p>:null}{notice?<motion.p initial={{opacity:0,y:-3}} animate={{opacity:1,y:0}} role="status" className="border-l-2 border-emerald-300 bg-emerald-300/[0.04] px-3 py-2 text-sm leading-6 text-emerald-100">{notice}</motion.p>:null}</AnimatePresence>
          <button type="submit" disabled={pending||Boolean(notice)} aria-busy={phase === "authenticating"} className="app-button-accent w-full">{phase === "authenticating" ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-center text-xs text-white/40">{mode === "signup" ? "Already have an account? " : "New to Disciplin? "}<Link href={`/auth/login?mode=${mode === "signup" ? "signin" : "signup"}&next=${encodeURIComponent(params.has("next") ? next : mode === "signup" ? "/" : "/onboarding")}`} className="font-semibold text-white/80 underline decoration-white/20 underline-offset-4 hover:text-white">{mode === "signup" ? "Sign in" : "Create account"}</Link></p>
      </motion.div>
    </section>
  </main>;
}

export default function LoginPage(){return <Suspense fallback={<main className="app-canvas grid place-items-center text-white/45"><div className="app-surface w-[min(90vw,360px)] p-5"><div className="app-skeleton h-4 w-28"/></div></main>}><LoginPageInner/></Suspense>}
