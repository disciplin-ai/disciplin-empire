import GymsSlugClient from "../../../../components/GymSlugClient";

export default function Page({ params }: { params: { slug: string } }) {
  return <GymsSlugClient slug={params.slug} />;
}