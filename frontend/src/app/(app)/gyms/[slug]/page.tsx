import GymsSlugClient from "../../../../components/GymSlugClient";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GymsSlugClient slug={slug} />;
}
