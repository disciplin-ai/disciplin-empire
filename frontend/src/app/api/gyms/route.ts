import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
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
    console.error("Error fetching gyms:", error);
    return NextResponse.json(
      { error: "Failed to load gyms" },
      { status: 500 }
    );
  }

  return NextResponse.json({ gyms: data ?? [] });
}
