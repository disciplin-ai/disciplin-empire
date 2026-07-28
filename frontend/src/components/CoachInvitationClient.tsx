"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { useCoach } from "@/components/CoachProvider";

type InvitationSummary = {
  athleteName: string;
  coachName: string;
  academyName?: string | null;
  expiresAt: string;
  usable: boolean;
  status: string;
};

export default function CoachInvitationClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useProfile();
  const { announceMutation } = useCoach();
  const token = params.get("token") || "";
  const [summary, setSummary] = useState<InvitationSummary | null>(null);
  const [resolving, setResolving] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !token) return;
    let cancelled = false;
    fetch("/api/coach/invitations/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", token }),
    })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok || !payload?.ok) setError(payload?.error || "This invitation is unavailable.");
        else setSummary(payload.invitation);
      })
      .catch(() => {
        if (!cancelled) setError("This invitation could not be checked.");
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => { cancelled = true; };
  }, [loading, token, user]);

  async function respond(action: "accept" | "decline") {
    setPending(true);
    setError(null);
    const response = await fetch("/api/coach/invitations/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "The invitation response could not be recorded.");
      setPending(false);
      return;
    }
    announceMutation();
    router.replace(action === "accept" ? "/coach" : "/");
    router.refresh();
  }

  const next = `/coach/invitation?token=${encodeURIComponent(token)}`;
  return (
    <main className="app-canvas grid min-h-screen place-items-center px-5 py-10">
      <section className="app-card w-full max-w-xl p-6 sm:p-8">
        <p className="app-brand">DISCIPLIN</p>
        <p className="app-label mt-8 text-emerald-200/70">Coach invitation</p>
        <h1 className="app-title-section mt-3">Review the connection.</h1>
        {!token ? <p className="mt-5 text-rose-100" role="alert">This invitation link is invalid.</p> : null}
        {loading || resolving ? <div className="app-skeleton mt-6 h-28" aria-label="Checking invitation" /> : null}
        {!loading && !user && token ? (
          <div className="mt-6">
            <p className="app-body-secondary">Sign in with the email address this invitation was sent to. Signing in alone grants no coach authority.</p>
            <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="app-button-accent mt-6">Sign in to review</Link>
          </div>
        ) : null}
        {summary && user ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="text-lg font-semibold text-white">{summary.athleteName}</p>
              <p className="mt-2 text-sm leading-6 text-white/55">invited {summary.coachName} to review submitted corrections. You may approve, edit and approve, or reject. You cannot alter historical approved versions.</p>
              {summary.academyName ? <p className="mt-3 text-xs text-white/40">{summary.academyName}</p> : null}
              <p className="mt-3 text-xs text-white/40">Expires {new Date(summary.expiresAt).toLocaleString()}</p>
            </div>
            {summary.usable ? <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => void respond("accept")} className="app-button-accent">Accept connection</button><button type="button" disabled={pending} onClick={() => void respond("decline")} className="app-button-secondary">Decline</button></div> : <p className="mt-5 text-amber-100">This invitation is no longer available.</p>}
          </div>
        ) : null}
        {error ? <p className="mt-5 text-sm text-rose-100" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
