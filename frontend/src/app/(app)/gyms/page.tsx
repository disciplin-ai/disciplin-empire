import { notFound } from "next/navigation";
import GymsClient from "../../../components/GymsClient";

// Opt out of prerendering so notFound() can set a real 404 status: this route
// sits inside the (app) Suspense boundary, which otherwise flushes 200 first.
export const dynamic = "force-dynamic";

/*
  Gym discovery is not one of the five questions Disciplin answers (today,
  readiness, evidence, improvement, identity), and the list is already
  unreachable from the athlete app — nothing links to it. It also ships a
  visible defect: the "Verified" and discipline badges are inline-block
  siblings under a space-y rule that does not apply to them, so they render
  touching, as "Verifiedmma".

  Held out of production rather than deleted, pending a decision to redesign,
  archive, or remove. The component and the gym APIs are untouched — Sensei
  still reads gym data for its gym-decision path.
*/
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();

  return <GymsClient />;
}
