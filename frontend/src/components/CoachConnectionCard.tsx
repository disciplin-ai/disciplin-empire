"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCoach } from "@/components/CoachProvider";
import { useProfile } from "@/components/ProfileProvider";
import { coachConnectionLabel } from "@/lib/coach/contracts";

type InvitationResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  developmentLink?: string;
};

export default function CoachConnectionCard() {
  const { profile } = useProfile();
  const { state, loading, error: loadError, announceMutation, refresh } = useCoach();
  const relationship = state.athleteRelationship;
  const [coachName, setCoachName] = useState(profile?.coachName ?? "");
  const [coachEmail, setCoachEmail] = useState("");
  const [academyName, setAcademyName] = useState(profile?.gym ?? "");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [developmentLink, setDevelopmentLink] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  async function invitationAction(action: "create" | "resend") {
    setPending(true);
    setNotice(null);
    setError(null);
    setDevelopmentLink(null);
    try {
      const response = await fetch("/api/coach/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "resend"
            ? { action, relationshipId: relationship?.id }
            : {
                action,
                coachName,
                coachEmail,
                academyName,
                athleteName: profile?.name,
              },
        ),
      });
      const payload = (await response.json().catch(() => null)) as InvitationResponse | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "The invitation could not be created.");
        return;
      }
      setNotice(payload.message || "Invitation created");
      setDevelopmentLink(payload.developmentLink || null);
      announceMutation();
    } catch {
      setError("The invitation could not be created. Check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  async function cancelInvitation() {
    if (!relationship) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/coach/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipId: relationship.id }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) setError(payload?.error || "The invitation could not be cancelled.");
    else {
      setNotice("Invitation cancelled");
      announceMutation();
    }
    setPending(false);
  }

  async function disconnect() {
    if (!relationship) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/coach/relationships/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipId: relationship.id }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) setError(payload?.error || "The coach could not be disconnected.");
    else {
      setNotice("Coach disconnected. Past approvals remain in your history.");
      announceMutation();
    }
    setPending(false);
  }

  return (
    <section id="coach-connection" className="app-card scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="app-label text-emerald-200/70">Coach connection</p>
          <h2 className="app-title-card mt-2">{coachConnectionLabel(relationship)}</h2>
          <p className="app-body-secondary mt-2 max-w-2xl">
            {relationship
              ? "Only the coach who accepts this invitation can review and approve your work."
              : "Connect your coach so they can review and approve the corrections you record."}
          </p>
        </div>
        {relationship?.status === "connected" ? (
          <Link href="/dashboard" className="app-button-secondary">Return to Dashboard</Link>
        ) : null}
      </div>

      {loading ? <div className="app-skeleton mt-5 h-20" aria-label="Loading coach connection" /> : null}
      {loadError ? (
        <div role="alert" className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100">
          <p>{loadError.message}</p>
          {loadError.retryable ? (
            <button type="button" onClick={() => void refresh()} className="mt-3 font-semibold underline underline-offset-4">Retry</button>
          ) : null}
        </div>
      ) : null}

      {!loading && !loadError && !relationship && !showInviteForm ? (
        <button
          type="button"
          className="app-button-accent mt-5"
          onClick={() => setShowInviteForm(true)}
        >
          Invite your coach
        </button>
      ) : null}

      {!loading && !loadError && !relationship && showInviteForm ? (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void invitationAction("create");
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold text-white/60">Coach name</span>
            <input className="app-input mt-2" required maxLength={80} value={coachName} onChange={(event) => setCoachName(event.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-white/60">Coach email</span>
            <input className="app-input mt-2" required type="email" autoComplete="email" maxLength={254} value={coachEmail} onChange={(event) => setCoachEmail(event.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-white/60">Academy or gym <span className="text-white/32">(optional)</span></span>
            <input className="app-input mt-2" maxLength={120} value={academyName} onChange={(event) => setAcademyName(event.target.value)} />
          </label>
          <p className="text-sm leading-6 text-white/48 sm:col-span-2">
            Your coach can review your work after accepting the invitation.
          </p>
          <button type="submit" disabled={pending} className="app-button-accent sm:col-span-2">
            {pending ? "Creating invitation…" : "Send invitation"}
          </button>
        </form>
      ) : null}

      {relationship?.status === "invited" ? (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-white/40">Coach</dt><dd className="mt-1 font-semibold text-white">{relationship.coach_display_name}</dd></div>
            <div><dt className="text-white/40">Email</dt><dd className="mt-1 break-all font-semibold text-white">{relationship.invited_email}</dd></div>
            <div><dt className="text-white/40">Connection</dt><dd className="mt-1 font-semibold text-amber-100">Awaiting acceptance</dd></div>
            <div><dt className="text-white/40">Invitation</dt><dd className="mt-1 font-semibold text-white">{coachConnectionLabel(relationship)}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void invitationAction("resend")} className="app-button-secondary">Resend</button>
            <button type="button" disabled={pending} onClick={() => void cancelInvitation()} className="app-button-quiet text-rose-100">Cancel invitation</button>
          </div>
        </div>
      ) : null}

      {relationship?.status === "connected" ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
          <p className="font-semibold text-white">{relationship.coach_display_name}</p>
          <p className="mt-1 text-sm text-white/48">{relationship.invited_email}</p>
          <p className="mt-3 text-sm leading-6 text-white/55">
            This coach reviews your corrections. Disconnecting stops future approvals and locks Sensei. Past approvals stay in your history.
          </p>
          {state.versions.length ? (
            <details className="mt-4 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Approved corrections · {state.versions.length}
              </summary>
              <div className="mt-4 space-y-3">
                {state.versions.map((version) => (
                  <div key={version.id} className="border-t border-white/[0.06] pt-3 first:border-0 first:pt-0">
                    <p className="text-xs font-semibold text-emerald-100">Approved {new Date(version.approved_at).toLocaleDateString()}</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{version.correction_text}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {confirmDisconnect ? (
            <div className="mt-4 rounded-2xl border border-rose-300/18 bg-rose-300/[0.04] p-4">
              <p className="text-sm leading-6 text-rose-50/80">
                Sensei will lock immediately. Past coach approvals will remain in your history.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => void disconnect()} className="app-button-secondary text-rose-100">Confirm disconnect</button>
                <button type="button" disabled={pending} onClick={() => setConfirmDisconnect(false)} className="app-button-quiet">Keep connection</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={pending} onClick={() => setConfirmDisconnect(true)} className="app-button-quiet mt-4 text-rose-100">Disconnect coach</button>
          )}
        </div>
      ) : null}

      {developmentLink ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4" role="status">
          <p className="text-sm font-semibold text-cyan-100">Invite link ready</p>
          <p className="mt-1 text-xs leading-5 text-white/45">No email was sent. Share this single-use link directly with your coach.</p>
          <a href={developmentLink} className="mt-3 block break-all text-sm font-semibold text-cyan-100 underline underline-offset-4">{developmentLink}</a>
        </div>
      ) : null}
      {notice ? <p className="mt-4 text-sm text-emerald-100" role="status">{notice}</p> : null}
      {error ? (
        <div className="mt-4 text-sm text-rose-100" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
    </section>
  );
}
