// src/app/api/gyms/near/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type GymRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  disciplines: string[];
  grind_score: number;
  style_tags: string[] | null;
  price_tier: string | null;
  maps_url: string | null;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371; // Earth radius (km)
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

// simple scoring: grind + distance (we’ll plug fighter profile later)
function scoreGym(gym: GymRow, distanceKm: number): number {
  let score = 0;

  // grind
  if (gym.grind_score >= 4) score += 30;
  else if (gym.grind_score === 3) score += 15;

  // distance bonus
  if (distanceKm < 2) score += 30;
  else if (distanceKm < 5) score += 20;
  else if (distanceKm < 10) score += 10;

  return score;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return new Response(JSON.stringify({ gyms: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("verified", true);

  if (error) {
    console.error("[Gyms Near] Supabase error:", error);
    return new Response(JSON.stringify({ gyms: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gyms = (data || []) as GymRow[];

  const gymsWithScore = gyms.map((g) => {
    const distanceKm = haversineKm(lat, lng, g.latitude, g.longitude);
    const matchScore = scoreGym(g, distanceKm);
    return { ...g, distanceKm, matchScore };
  });

  gymsWithScore.sort((a, b) => b.matchScore - a.matchScore);

  return new Response(
    JSON.stringify({
      gyms: gymsWithScore,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
