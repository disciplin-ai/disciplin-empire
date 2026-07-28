"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "@/components/ProfileProvider";
import { useCoach } from "@/components/CoachProvider";
import type { MissionSubmissionRecord } from "@/lib/coach/contracts";

export default function CoachHomeClient() {
  const { user, loading: profileLoading, signOut } = useProfile();
  const { state, loading, error, refresh, announceMutation } = useCoach();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [practiceTask, setPracticeTask] = useState("");
  const [athleteContext, setAthleteContext] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);

  const reviewItems = useMemo(
    () =>
      state.submissions.filter(
        (submission) =>
          submission.status === "pending" &&
          state.coachedRelationships.some(
            (relationship) => relationship.id === submission.relationship_id,
          ),
      ),
    [state.coachedRelationships, state.submissions],
  );

  function relationshipFor(submission: MissionSubmissionRecord) {
    return state.coachedRelationships.find(
      (relationship) => relationship.id === submission.relationship_id,
    );
  }

  async function decide(
    submission: MissionSubmissionRecord,
    decision: "approve" | "edit_and_approve" | "reject",
  ) {
    setPendingId(submission.id);
    setNotice(null);
    setActionError(null);
    const response = await fetch("/api/coach/missions/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: submission.id,
        decision,
        correction: decision === "edit_and_approve" ? correction : undefined,
        practiceTask: decision === "edit_and_approve" ? practiceTask : undefined,
        athleteContext: decision === "edit_and_approve" ? athleteContext : undefined,
        rejectionReason: decision === "reject" ? rejectionReason : undefined,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setActionError(payload?.error || "The decision could not be recorded.");
    } else {
      setNotice(
        decision === "reject"
          ? "Submission rejected."
          : decision === "edit_and_approve"
            ? "Your edited version is now the approved mission."
            : "The athlete’s original submission is now the approved mission.",
      );
      setEditingId(null);
      setRejectionReason("");
      announceMutation();
    }
    setPendingId(null);
  }

  async function disconnectRelationship(relationshipId: string) {
    setPendingId(relationshipId);
    setActionError(null);
    const response = await fetch("/api/coach/relationships/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationshipId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setActionError(payload?.error || "The connection could not be ended.");
    } else {
      setNotice("Connection ended. Approved history was preserved and active authority was removed.");
      setConfirmDisconnectId(null);
      announceMutation();
    }
    setPendingId(null);
  }

  if (profileLoading || loading) {
    return <main className="app-canvas min-h-screen px-5 py-8"><div className="app-surface mx-auto max-w-5xl p-6"><div className="app-skeleton h-8 w-56" /><div className="app-skeleton mt-6 h-40" /></div></main>;
  }
  if (!user) {
    return <main className="app-canvas grid min-h-screen place-items-center p-5"><section className="app-card max-w-md p-6"><h1 className="app-title-section">Coach sign-in required</h1><p className="app-body-secondary mt-3">Sign in with the email used in the athlete’s invitation.</p><Link href="/auth/login?next=%2Fcoach" className="app-button-accent mt-6">Sign in</Link></section></main>;
  }

  return (
    <main className="app-canvas min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div><p className="app-brand">DISCIPLIN</p><h1 className="app-title-section mt-2">Coach review</h1></div>
          <button type="button" onClick={() => void signOut()} className="app-button-quiet">Log out</button>
        </header>

        {error ? (
          <section className="app-card mt-6 p-5" role="alert">
            <p className="text-rose-100">{error.message}</p>
            {error.retryable ? (
              <button type="button" className="app-button-secondary mt-4" onClick={() => void refresh()}>Retry</button>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6">
          <p className="app-label text-emerald-200/70">Needs review</p>
          <h2 className="app-title-card mt-2">{reviewItems.length ? `${reviewItems.length} waiting` : "Nothing waiting"}</h2>
          <div className="mt-4 space-y-4">
            {reviewItems.map((submission) => {
              const relationship = relationshipFor(submission);
              const editing = editingId === submission.id;
              return (
                <article key={submission.id} className="app-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="app-label">Athlete submission</p><h3 className="mt-2 text-lg font-semibold text-white">{relationship?.athlete_display_name || "Connected athlete"}</h3></div>
                    <time className="text-xs text-white/38">{new Date(submission.submitted_at).toLocaleString()}</time>
                  </div>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div><dt className="app-label">Exact correction</dt><dd className="mt-2 leading-6 text-white">{submission.correction_text}</dd></div>
                    <div><dt className="app-label">Practice task</dt><dd className="mt-2 leading-6 text-white">{submission.practice_task}</dd></div>
                    {submission.athlete_context ? <div className="sm:col-span-2"><dt className="app-label">Athlete context</dt><dd className="mt-2 leading-6 text-white/65">{submission.athlete_context}</dd></div> : null}
                  </dl>

                  {editing ? (
                    <div className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
                      <label className="block"><span className="text-xs font-semibold text-white/55">Approved correction</span><textarea className="app-input mt-2 min-h-24 py-3" value={correction} onChange={(event) => setCorrection(event.target.value)} /></label>
                      <label className="block"><span className="text-xs font-semibold text-white/55">Approved practice task</span><textarea className="app-input mt-2 min-h-24 py-3" value={practiceTask} onChange={(event) => setPracticeTask(event.target.value)} /></label>
                      <label className="block"><span className="text-xs font-semibold text-white/55">Context retained with approved version</span><textarea className="app-input mt-2 min-h-20 py-3" value={athleteContext} onChange={(event) => setAthleteContext(event.target.value)} /></label>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" disabled={pendingId === submission.id} onClick={() => void decide(submission, "approve")} className="app-button-accent">Approve exact submission</button>
                    <button type="button" disabled={pendingId === submission.id} onClick={() => {
                      if (editing) void decide(submission, "edit_and_approve");
                      else {
                        setEditingId(submission.id);
                        setCorrection(submission.correction_text);
                        setPracticeTask(submission.practice_task);
                        setAthleteContext(submission.athlete_context || "");
                      }
                    }} className="app-button-secondary">{editing ? "Approve edited version" : "Edit and approve"}</button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input aria-label="Rejection reason" placeholder="Reason required to reject" className="app-input" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
                    <button type="button" disabled={pendingId === submission.id || !rejectionReason.trim()} onClick={() => void decide(submission, "reject")} className="app-button-quiet shrink-0 text-rose-100">Reject</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="app-card mt-6 p-5">
          <p className="app-label text-emerald-200/70">Connected athletes</p>
          <div className="mt-4 space-y-3">
            {state.coachedRelationships.length ? state.coachedRelationships.map((relationship) => (
              <div key={relationship.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-semibold text-white">{relationship.athlete_display_name}</p><p className="mt-1 text-xs text-white/42">Connected {relationship.accepted_at ? new Date(relationship.accepted_at).toLocaleDateString() : ""}</p></div>
                  <button type="button" onClick={() => setConfirmDisconnectId(relationship.id)} className="app-button-quiet min-h-9 text-xs text-rose-100">End connection</button>
                </div>
                {confirmDisconnectId === relationship.id ? (
                  <div className="mt-4 border-t border-white/[0.07] pt-4">
                    <p className="text-sm leading-6 text-white/55">This removes active authority and locks the athlete’s Sensei mission. History remains.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={pendingId === relationship.id} onClick={() => void disconnectRelationship(relationship.id)} className="app-button-secondary text-rose-100">Confirm</button>
                      <button type="button" onClick={() => setConfirmDisconnectId(null)} className="app-button-quiet">Keep connection</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )) : <p className="app-body-secondary">Accept an athlete invitation to create a coach connection.</p>}
          </div>
        </section>

        <section className="app-card mt-6 p-5">
          <p className="app-label text-emerald-200/70">Decision history</p>
          <h2 className="app-title-card mt-2">Approved versions and rejections</h2>
          <div className="mt-4 space-y-3">
            {state.versions.map((version) => {
              const relationship = state.coachedRelationships.find(
                (item) => item.id === version.relationship_id,
              );
              return (
                <article key={version.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {relationship?.athlete_display_name || "Athlete"} · Version {version.version_number}
                    </p>
                    <span className="text-xs text-emerald-100">
                      {version.approval_kind === "edited_and_approved" ? "Edited and approved" : "Approved"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-white/82">{version.correction_text}</p>
                  <p className="mt-1 text-sm leading-6 text-white/48">{version.practice_task}</p>
                  <time className="mt-3 block text-xs text-white/32">{new Date(version.approved_at).toLocaleString()}</time>
                </article>
              );
            })}
            {state.submissions.filter((submission) => submission.status === "rejected").map((submission) => (
              <article key={submission.id} className="rounded-2xl border border-rose-300/12 bg-rose-300/[0.025] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-100/65">Rejected</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/78">{submission.correction_text}</p>
                <p className="mt-2 text-sm leading-6 text-white/45">{submission.rejection_reason}</p>
              </article>
            ))}
            {!state.versions.length && !state.submissions.some((submission) => submission.status === "rejected") ? (
              <p className="app-body-secondary">No coach decisions have been recorded yet.</p>
            ) : null}
          </div>
        </section>

        {notice ? <p className="mt-5 text-sm text-emerald-100" role="status">{notice}</p> : null}
        {actionError ? <p className="mt-5 text-sm text-rose-100" role="alert">{actionError}</p> : null}
      </div>
    </main>
  );
}
