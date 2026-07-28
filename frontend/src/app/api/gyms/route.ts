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

export async function GET(req: NextRequest) {
  const id = requestId(req);
  try {
    const supabase = getSupabaseServerClient();

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q")?.toLowerCase().trim() ?? "";
    const q = rawQuery.replace(/[^a-z0-9 '\-]/g, "").slice(0, 80);
    const discipline = searchParams.get("discipline");
    const verified = searchParams.get("verified");

    let query = supabase.from("gyms").select("*");

    if (discipline && discipline !== "all") {
      query = query.contains("disciplines", [discipline]);
    }

    if (verified === "true") {
      query = query.eq("is_verified", true);
    }

    if (q) {
      query = query.or(
        `name.ilike.%${q}%,city.ilike.%${q}%,country.ilike.%${q}%`
      );
    }

    const { data, error } = await query.limit(200);

    if (error) {
      logServerError("gyms-query", id);
      return safeServerError(id);
    }

    return NextResponse.json({ gyms: data ?? [] });
  } catch (error) {
    logServerError("gyms", id, error);
    return safeServerError(id);
  }
}
