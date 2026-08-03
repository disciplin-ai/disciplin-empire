# The fighter report was removed, not abandoned

Removed in the institutional-memory foundations work, from
`frontend/src/lib/report/buildFighterReport.ts`,
`frontend/src/components/FighterReportCard.tsx`, and the `/report` route.

## Why

It presented Striking IQ, Defensive Awareness, Wrestling Chains and Cardio Pace
as if they were measurements of an athlete. They were not. Each began at a
hardcoded constant — 76, 74, 80, 71 — and moved by keyword matches against
free-text profile fields. A wrestler who had never recorded a strike still
scored 76 for striking.

The same screen authored a "Next directive", which is a coaching decision, and
offered a Share button so the whole thing could be sent to someone who would
reasonably read it as an assessment.

Gating the route was not enough: the scoring logic still compiled into the
production bundle, so the strings were discoverable by anyone reading it.

## What a report may be built from later

The idea is worth keeping. A future report may be assembled only from:

- **durable evidence** — `evidence_assets` and the observations recorded against
  them, which survive a cleared browser and a coach leaving;
- **coach-authored decisions** — approvals in `mission_versions`, with the
  actor, role and organisation as they were at the time;
- **recorded outcomes** — whether a correction held or broke under resistance,
  once that model exists.

Three rules for whoever rebuilds it:

1. No number appears unless it is derived from recorded events. No constants.
2. Nothing is labelled as an assessment unless a coach made it.
3. Every figure can name the evidence behind it.

If a value cannot satisfy all three, it does not belong on the report.
