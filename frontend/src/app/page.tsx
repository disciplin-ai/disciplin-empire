import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type SearchParams = Promise<{
  code?: string;
  next?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const code = params?.code;
  const next = params?.next || "/dashboard";

  // If OAuth returned to /?code=..., forward it to the real callback route
  if (code) {
    const qs = new URLSearchParams({
      code,
      next,
    });

    redirect(`/auth/callback?${qs.toString()}`);
  }

  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  redirect("/auth/login");
}