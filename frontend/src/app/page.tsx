import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  code?: string;
  next?: string;
}>;

function needsFighterFile(data: Record<string, unknown> | null | undefined) {
  if (!data) return true;

  return (
    !data.name ||
    !data.age ||
    !data.primaryArt ||
    !data.experience ||
    !data.currentPhase
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const code = params?.code;
  const next = params?.next || "/profile?setup=1";

  if (code) {
    const qs = new URLSearchParams({
      code,
      next,
    });

    redirect(`/auth/callback?${qs.toString()}`);
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("data")
    .eq("id", user.id)
    .maybeSingle();

  if (needsFighterFile(profile?.data as Record<string, unknown> | null)) {
    redirect("/profile?setup=1");
  }

  redirect("/dashboard");
}