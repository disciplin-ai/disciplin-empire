import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuthHome() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged in
  if (user) {
    redirect("/dashboard");
  }

  // Not logged in
  redirect("/auth/login");
}