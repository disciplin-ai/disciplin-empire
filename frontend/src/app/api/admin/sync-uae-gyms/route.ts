import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// UAE area; we fetch nodes + ways with martial-arts-related names or sport tags
const OVERPASS_QUERY = `
[out:json][timeout:90];
area["ISO3166-1"="AE"]->.searchArea;

(
  // Anything explicitly tagged as martial arts / boxing / wrestling / judo / etc.
  node["sport"~"martial_arts|boxing|wrestling|judo|sambo|muay_thai|kickboxing"](area.searchArea);
  way["sport"~"martial_arts|boxing|wrestling|judo|sambo|muay_thai|kickboxing"](area.searchArea);

  // Gyms whose NAME looks like combat sports
  node["amenity"="gym"]["name"~"MMA|BJJ|Jiu Jitsu|Jiu-Jitsu|Grappling|Muay Thai|Kickboxing|Boxing|Sambo|Wrestling"](area.searchArea);
  way["amenity"="gym"]["name"~"MMA|BJJ|Jiu Jitsu|Jiu-Jitsu|Grappling|Muay Thai|Kickboxing|Boxing|Sambo|Wrestling"](area.searchArea);

  // Fitness centres with combat names
  node["leisure"="fitness_centre"]["name"~"MMA|BJJ|Jiu Jitsu|Grappling|Muay Thai|Kickboxing|Boxing|Sambo|Wrestling"](area.searchArea);
  way["leisure"="fitness_centre"]["name"~"MMA|BJJ|Jiu Jitsu|Grappling|Muay Thai|Kickboxing|Boxing|Sambo|Wrestling"](area.searchArea);
);

out center body;
>;

out skel qt;
`;

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  type?: "node" | "way" | "relation";
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
};

function inferDisciplines(
  tags: Record<string, string> | undefined
): { primary_discipline: string; disciplines: string[] } | null {
  if (!tags) return null;

  const blob = (
    (tags.sport || "") +
    " " +
    (tags.name || "") +
    " " +
    (tags.description || "")
  ).toLowerCase();

  const disciplines: string[] = [];

  const add = (kw: string | RegExp, label: string) => {
    if (
      (typeof kw === "string" && blob.includes(kw)) ||
      (kw instanceof RegExp && kw.test(blob))
    ) {
      if (!disciplines.includes(label)) disciplines.push(label);
    }
  };

  // MMA
  add("mma", "MMA");
  add("mixed martial", "MMA");

  // BJJ / grappling
  add("bjj", "BJJ");
  add("jiu jitsu", "BJJ");
  add("jiu-jitsu", "BJJ");
  add("jiujitsu", "BJJ");
  add("grappling", "Grappling");
  add("no-gi", "Grappling");
  add("nogi", "Grappling");

  // Boxing / striking
  add("boxing", "Boxing");
  add(/kick[- ]?boxing/, "Kickboxing");
  add("muay thai", "Muay Thai");
  add("thai boxing", "Muay Thai");
  add("k1", "Kickboxing");

  // Wrestling
  add("wrestling", "Wrestling");
  add("freestyle wrestling", "Wrestling");
  add("greco", "Wrestling");

  // Sambo / Judo
  add("sambo", "Sambo");
  add("combat sambo", "Sambo");
  add("judo", "Judo");

  if (disciplines.length === 0) return null;

  return {
    primary_discipline: disciplines[0],
    disciplines,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key || key !== process.env.ADMIN_SYNC_KEY) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new NextResponse("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const overpassRes = await fetch(OVERPASS_URL, {
      method: "POST",
      body: OVERPASS_QUERY,
    });

    if (!overpassRes.ok) {
      const text = await overpassRes.text();
      console.error("Overpass error:", text);
      return new NextResponse("Overpass error", { status: 502 });
    }

    const data = await overpassRes.json();
    const elements: OverpassElement[] = data.elements ?? [];

    const rows = elements
      .map((el) => {
        const coordLat = el.lat ?? el.center?.lat;
        const coordLon = el.lon ?? el.center?.lon;

        if (coordLat == null || coordLon == null) return null;

        const tags = el.tags || {};
        const discInfo = inferDisciplines(tags);
        if (!discInfo) return null;

        const { primary_discipline, disciplines } = discInfo;

        const name =
          tags.name ||
          tags["name:en"] ||
          tags["name:ar"] ||
          "Unnamed Gym";

        return {
          name,
          city: tags["addr:city"] || null,
          country: "United Arab Emirates",
          address: tags["addr:full"] || null,
          latitude: coordLat,
          longitude: coordLon,
          primary_discipline,
          disciplines,
          style_tags: [],
          intensity_label: null,
          level_label: null,
          price_label: null,
          is_verified: false,
          google_maps_url: `https://www.google.com/maps?q=${coordLat},${coordLon}`,
          website: tags.website || null,
          osm_id: String(el.id),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return NextResponse.json({
        message: "No martial arts gyms found from Overpass (AE).",
      });
    }

    const { error } = await supabase
      .from("gyms")
      .upsert(rows, { onConflict: "osm_id" });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json(
        {
          message: "Supabase upsert failed",
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
      message: "Sync complete",
      totalFromOSM: elements.length,
      upserted: rows.length,
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new NextResponse("Unexpected error", { status: 500 });
  }
}
