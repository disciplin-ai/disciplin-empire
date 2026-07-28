import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unauthorized } from "@/lib/security/responses";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return unauthorized();
  return NextResponse.json({ authenticated: true });
}
