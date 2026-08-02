import { notFound } from "next/navigation";
import GymsSlugClient from "../../../../components/GymSlugClient";

// Opt out of prerendering so notFound() can set a real 404 status: this route
// sits inside the (app) Suspense boundary, which otherwise flushes 200 first.
export const dynamic = "force-dynamic";

/* Held out of production alongside the gym list. See ../page.tsx. */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { slug } = await params;
  return <GymsSlugClient slug={slug} />;
}
