import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logServerError, requestId, safeServerError } from "@/lib/security/responses";

export const dynamic = "force-dynamic";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const id = requestId(req);

  try {
    const supabase = getSupabaseServerClient();
    const { slug } = await params;

    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (gymError) {
      logServerError("gym-detail", id, gymError);
      return safeServerError(id);
    }

    if (!gym) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }

    const [{ data: coaches }, { data: programs }, { data: rating }] = await Promise.all([
      supabase.from("gym_coaches").select("*").eq("gym_id", gym.id),
      supabase.from("gym_programs").select("*").eq("gym_id", gym.id),
      supabase.from("gym_ratings").select("*").eq("gym_id", gym.id).maybeSingle(),
    ]);

    return NextResponse.json({
      gym,
      coaches: coaches ?? [],
      programs: programs ?? [],
      // Real, sourced rating aggregate only — never a fabricated per-user review.
      rating: rating ?? null,
    });
  } catch (error) {
    logServerError("gym-detail", id, error);
    return safeServerError(id);
  }
}
