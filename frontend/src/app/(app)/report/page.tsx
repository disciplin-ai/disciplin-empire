import { notFound } from "next/navigation";
import ReportClient from "./ReportClient";

// Opt out of prerendering so notFound() can set a real 404 status: this route
// sits inside the (app) Suspense boundary, which otherwise flushes 200 first.
export const dynamic = "force-dynamic";

/*
  The fighter report presents Striking IQ, Defensive Awareness, Wrestling
  Chains and Cardio Pace as if they were measurements. They are not: each
  begins at a hardcoded constant (76, 74, 80, 71) and is nudged by keyword
  matches against free-text profile fields. A wrestler who has never recorded
  a strike still scores 76 for striking. The screen also authors a "Next
  directive", which is a coaching decision that belongs to the coach alone.

  Until those numbers are derived from real evidence, the screen must not
  reach an athlete, a coach, or anyone evaluating Disciplin. It stays
  available in development so the work can continue.
*/
export default function ReportPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <ReportClient />;
}
