import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GymSeed = {
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_discipline: string;
  disciplines: string[];
  style_tags: string[];
  intensity_label: string | null;
  level_label: string | null;
  price_label: string | null;
  is_verified: boolean;
  google_maps_url: string | null;
  website: string | null;
  osm_id: string | null; // null = manual entry
};

// 🔐 Re-use your existing admin key (same as sync-uae-gyms)
const ADMIN_KEY = process.env.ADMIN_SYNC_KEY;

// ✅ Your curated UAE gyms (you can refine coords/URLs later)
const gyms: GymSeed[] = [
  // ------- DUBAI -------

  {
    name: "971 MMA Academy",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "Grappling", "Striking"],
    style_tags: ["pressure", "competition", "no-gi"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "TK MMA & Fitness",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "Muay Thai", "Boxing", "Conditioning"],
    style_tags: ["striking", "athletic", "fight-team"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "10th Planet Jiu Jitsu Dubai",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "BJJ",
    disciplines: ["BJJ", "Grappling", "No-Gi"],
    style_tags: ["system-based", "no-gi", "creative guard"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "Team Nogueira Dubai",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "BJJ", "Boxing"],
    style_tags: ["brazilian", "competition", "grappling"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "Muay Thai Muppets (GymNation Al Quoz)",
    city: "Dubai",
    country: "UAE",
    address: "GymNation Al Quoz, Dubai",
    latitude: null,
    longitude: null,
    primary_discipline: "Muay Thai",
    disciplines: ["Muay Thai", "Kickboxing"],
    style_tags: ["striking", "thai-style", "competition"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: "https://muaythaimuppetsmasterclass.com/",
    osm_id: null,
  },

  {
    name: "Kuma Team",
    city: "Dubai",
    country: "UAE",
    address: "3 6A Street, Al Quoz Industrial Area 3, Dubai",
    latitude: null,
    longitude: null,
    primary_discipline: "Wrestling",
    disciplines: ["Wrestling", "Sambo", "Judo", "BJJ", "Boxing"],
    style_tags: ["wrestling-heavy", "sambo", "competition"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "Dagestan Top Team Dubai",
    city: "Dubai",
    country: "UAE",
    address: "Al Joud Center, Al Quoz Industrial First, Dubai",
    latitude: null,
    longitude: null,
    primary_discipline: "Wrestling",
    disciplines: ["Wrestling", "Combat Sambo", "Judo", "MMA", "BJJ"],
    style_tags: ["dagestani", "pressure", "grappling"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "UFC Gym Dubai JBR",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "Boxing", "BJJ", "Conditioning"],
    style_tags: ["franchise", "fitness", "classes"],
    intensity_label: "Moderate",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true, // flip to false if you want chains unverified
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "ADMA Academy Dubai",
    city: "Dubai",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "BJJ", "Muay Thai", "Wrestling"],
    style_tags: ["kids-to-pro", "competition"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "Wellfit Boxing (JVC)",
    city: "Dubai",
    country: "UAE",
    address: "Jumeirah Village Circle, Dubai",
    latitude: null,
    longitude: null,
    primary_discipline: "Boxing",
    disciplines: ["Boxing", "Conditioning"],
    style_tags: ["fitness", "striking"],
    intensity_label: "Moderate",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true, // set false if you want only hardcore gyms verified
    google_maps_url: "https://www.wellfit.me/",
    website: "https://www.wellfit.me/",
    osm_id: null,
  },

  // ------- ABU DHABI -------

  {
    name: "ADMA Academy Abu Dhabi",
    city: "Abu Dhabi",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "BJJ", "Muay Thai", "Wrestling"],
    style_tags: ["competition", "kids-to-pro"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },

  {
    name: "Khabib Gym Abu Dhabi",
    city: "Abu Dhabi",
    country: "UAE",
    address: null,
    latitude: null,
    longitude: null,
    primary_discipline: "MMA",
    disciplines: ["MMA", "Wrestling", "Grappling"],
    style_tags: ["khabib-style", "pressure", "russia"],
    intensity_label: "Hard",
    level_label: "All levels",
    price_label: "$$",
    is_verified: true,
    google_maps_url: null,
    website: null,
    osm_id: null,
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!ADMIN_KEY || !key || key !== ADMIN_KEY) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new NextResponse("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await supabase.from("gyms").insert(gyms);

    if (error) {
      console.error("Error inserting gyms:", error);
      return NextResponse.json(
        {
          message: "Supabase insert failed",
          error: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Seed complete",
      inserted: gyms.length,
    });
  } catch (err: any) {
    console.error("Unexpected error in seed-uae-gyms:", err);
    return new NextResponse("Unexpected error", { status: 500 });
  }
}
