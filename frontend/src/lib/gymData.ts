// frontend/src/lib/gymData.ts

export type Gym = {
  slug: string;
  name: string;

  city?: string;
  country?: string;

  disciplines?: string[];
  tags?: string[];

  description?: string;

  rating?: number;
  reviewCount?: number;

  verified?: boolean;

  intensityLabel?: string;
  intensityColor?: "green" | "amber" | "red";

  photoUrl?: string;

  website?: string;
  googleMapsUrl?: string;

  reviewScores?: {
    pace: number;
    wrestlingRoom: number;
    strikingPace: number;
    coachQuality: number;
    recoveryCulture: number;
  };

  reviewSummary?: string;
};

export const gyms: Gym[] = [];
