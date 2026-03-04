import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function AuthHome() {
  const supabase = createServerSupabase();
  const { data } = await supabase.auth.getUser();

  // If logged in → go to dashboard
  if (data.user) {
    redirect("/dashboard");
  }

  // If not logged in → redirect to login page
  redirect("/auth/login");
}