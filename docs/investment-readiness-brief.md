# DISCiPLIN — Investment Readiness Brief

**Date:** 2026-07-28 (reconciled)
**Scope:** Technical audit and remediation of the DISCiPLIN platform (`disciplin-ai/disciplin-empire`) against the product's own governing document, `CONSTITUTION.md` — specifically the claim that the platform is a "Truth Engine" in which a human coach, not AI, holds final technical authority.

## Provenance note

An earlier version of this brief described a Coach-Gate implementation (`coach_athlete_links`/`correction_directives`) built against `main` without visibility into a more complete, independently-developed implementation that already existed locally. That implementation — preserved and pushed as `preserve/codex-current-ui-2026-07-28` — is now the integration base for the platform. Its authority model, coach-relationship system, and mission-versioning schema supersede what this brief originally described. The narrower schema is dropped rather than merged as a parallel system; this brief has been rewritten to describe the implementation actually in force.

## Executive summary

Before any of this work, DISCiPLIN's central claim — that a human coach is the only source of technical authority, and that AI ("Sensei") only reinforces what a coach has approved — was **not implemented** on `main`. There was no coach-approval data model anywhere in the codebase. Sensei and Sensei Vision both called an LLM to invent corrections and drills directly, and a third AI call self-judged whether the athlete had executed a correction, with no coach in that loop at any point. Separately, the frontend shipped hardcoded fabricated gym reviews and star ratings, and sold "Sensei AI" and "Fuel AI" as headline product features on the pricing page.

The implementation now in force closes this gap more completely than the narrower pass originally proposed: a formal 7-state `AuthorityState` model (`lib/authority/state.ts`) governs every screen; a real coach-relationship and mission-versioning schema (`015_coach_connection_mvp.sql`: `coach_relationships`, `coach_invitations`, `mission_submissions`, `mission_versions`, `current_coach_missions`, `coach_audit_events`) replaces narrative with an auditable data model; missions are authored directly by the coach (`coach_submit_mission`), so AI-generated text never enters the authority chain even as an unapproved draft; and Sensei's decision engine resolves its active correction server-side from the athlete's current mission pointer, never from client-supplied data. A coach-facing review and invitation UI exists (`app/coach`, `CoachHomeClient`, `CoachInvitationClient`), and 17 test files cover the authority, coach, workflow, and security contracts. The codebase builds and type-checks cleanly.

## What "Coach-Gate" means and why it mattered

The Constitution's hierarchy is: **Coach → Evidence → Approved correction → Preparation → Practice.** Concretely, Vision may *observe and suggest*, but only a coach may turn anything into what Sensei is allowed to tell an athlete to practise. Before this work existed:

- No table, column, or flag anywhere in the schema recorded a coach's approval of anything.
- Sensei took its "active correction" directly from client-supplied JSON — the same JSON Sensei Vision had just generated via LLM and the browser had cached in `localStorage`.
- Sensei Vision's own system prompt instructed the model to invent stop-commands, fix-next-rep instructions, and two full drills per frame — as final output, not as a suggestion.
- A "Proof Judge" route issued its own `accepted`/`rejected` verdicts on submitted evidence, entirely automated.
- None of `/api/sensei`, `/api/sensei-vision`, nor `/api/sensei-vision/proof` required authentication at all.

## What the implementation now in force does about it

1. **Schema** (`015_coach_connection_mvp.sql`): `coach_relationships` records the athlete-coach link and its lifecycle (invited/connected/declined/disconnected/revoked); `coach_invitations` and `mission_submissions`/`mission_versions`/`current_coach_missions` give the mission a full, immutable version history with a pointer to the athlete's current approved mission; `coach_audit_events` gives the system a durable audit trail. Row-level security and dedicated RPCs (e.g. `coach_submit_mission`) enforce who can write what at the database layer, not just the API layer.
2. **Server-side authority resolution** (`api/sensei/route.ts`): reads the athlete's `current_coach_missions` pointer, confirms the linked `coach_relationships` row is `connected`, then reads `mission_versions.correction_text` — the only path by which an "active correction" reaches Sensei. Client-supplied fields are never trusted. The route is authenticated and rate-limited per athlete+IP.
3. **Vision has no path into authority at all**: missions are authored directly by the coach through `coach_submit_mission`, informed by whatever the athlete or Vision surfaced in conversation — but no Vision output is ever inserted into a mission or correction table, approved or pending. This is a stronger realization of "AI never becomes the technical authority" than a suggest-then-approve pipeline would be, since AI-generated text can never become mission content even as an unreviewed draft.
4. **Coach-facing UI**: `app/coach/page.tsx` → `CoachHomeClient.tsx`, plus `CoachInvitationClient.tsx` for the invitation flow and `CoachConnectionCard.tsx` on the athlete's Profile screen — the review/approval surface a prior pass had identified as the biggest remaining gap already exists here.
5. **Tests**: 17 test files, including `authority/state.test.ts`, `coach/invitation.test.ts`, `coach/sensei.test.ts`, `coach/server.test.ts`, `coach/migration.test.ts`, `fuelAuthority.test.ts`, and `workflow/contracts.test.ts` — none of which existed in the narrower pass this brief originally described.

## Frontend violations fixed

| Violation | Status |
|---|---|
| Hardcoded fake gym reviews/star ratings (`GymSlugClient.tsx`) | **Ported this pass** — the implementation now in force had not fixed this independently; a real `api/gyms/[slug]` route reading `gyms`/`gym_coaches`/`gym_programs`/`gym_ratings` was added, field-compatible with the existing `GymsClient.tsx`. |
| "Dashboard, Sensei AI, and Fuel AI unlocked" on the pricing page | **Already fixed independently** — no "AI" language remains in the pricing copy. |
| Raw `Request failed (${res.status})` on a Fuel error | **Already fixed independently, more precisely** — auth failures are distinguished from generic ones. |
| Root README's "living empire" language | **Fixed**, docs-only. |
| Dead/unused components | **Partially actioned** — one (`AppFrame.tsx`) deleted after confirming zero references anywhere in the reconciled branch; the rest identified and classified but left for explicit confirmation before removal, since none was reintroduced or ported. |

## Verification performed

- `npx tsc --noEmit` — clean, no errors.
- `npx next build` (production build, placeholder env vars — no live Supabase/OpenAI credentials in this environment) — succeeds.
- `npx eslint` on every file touched — no new errors introduced.
- Test suite (`npm test`) — run against the reconciled branch; results reported alongside this brief rather than assumed.
- No live database or browser testing was possible in this environment. This is a code-level and build-level verification, not a QA sign-off against production data.

## Not done (recommended next phase)

1. **Dashboard consolidation.** `DashboardClient.tsx` still embeds a live Proof-upload form and a live weight-logging form that duplicate Vision/Fuel functionality rather than linking to it. Rewriting this without a browser to visually verify the result was judged too risky to do blind.
2. **`SenseiVisionClient.tsx` calls a route that doesn't exist** (`/api/sensei-vision/chat`) — a pre-existing bug, unrelated to Constitution work, not fixed this pass.
3. **Data-protection note** for `coach_relationships`/`mission_versions`/`coach_audit_events` — who can see what, retention, deletion — before real athlete data flows through it.
4. **Migration numbering.** The now-dropped `015_coach_athlete_links.sql` collided with `015_coach_connection_mvp.sql`. Whether this needs a renumbering plan depends on whether `015_coach_connection_mvp.sql` has already been deployed anywhere — that has not been confirmed from the repository alone, and no migration was deployed or renumbered as part of this reconciliation.

## Bottom line for investment review

The platform's central authority claim is backed by an actual, verifiable, immutable-versioned data model and server-side (and in places, database-level) enforcement — a stronger realization of the Constitution's claim than the narrower pass this brief originally described, not a competing one. The remaining items are UX consolidation and one pre-existing bug, not integrity gaps.
