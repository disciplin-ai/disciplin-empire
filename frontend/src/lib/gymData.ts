// src/app/lib/gymData.ts

export type GymProfile = {
  id: string;
  name: string;
  city: string;
  country: string;
  style: string;       // e.g. "MMA / Combat Sambo"
  level: string;       // e.g. "Pro / Amateur / Hobby"
  priceTier: string;   // e.g. "$$", "$$$"
  description: string;
  mapsUrl: string;     // Google Maps deep link
};

export const gyms: GymProfile[] = [
  {
    id: "kuma-sambo-dubai",
    name: "Kuma Sambo",
    city: "Dubai",
    country: "UAE",
    style: "Combat Sambo / MMA",
    level: "Amateur–Pro",
    priceTier: "$$",
    description:
      "Hard Sambo-style wrestling and MMA. Pressure sparring, tough rounds, no influencer nonsense.",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Kuma+Sambo+Dubai",
  },
  {
    id: "gor-mma-gori",
    name: "GOR MMA",
    city: "Gori",
    country: "Georgia",
    style: "MMA / Wrestling",
    level: "Amateur–Pro",
    priceTier: "$$",
    description:
      "Wrestling-heavy MMA gym with gritty rounds and strong clinch pressure.",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=GOR+MMA+Gori+Georgia",
  },
  // add more gyms here...
];
