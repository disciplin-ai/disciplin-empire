// src/app/api/sensei/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { buildCampState } from "@/lib/disciplin/buildCampState";
import { respondAsSensei } from "@/lib/disciplin/sensei/respond";
import type {
  CampAlert,
  FighterProfile,
  FuelLog,
  GymRecommendation,
  VisionFinding,
  WeightLog,
} from "@/lib/disciplin/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body?.message ?? "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    // Replace this mocked data with Supabase queries.
    const profile: FighterProfile = {
      fighterId: "fighter_1",
      name: "Greg",
      baseArt: "mma",
      stance: "orthodox",
      campGoal: "skill-correction",
      targetFightWeightKg: 72,
    };

    const visionFindings: VisionFinding[] = [
      {
        id: "vf_1",
        fighterId: "fighter_1",
        sourceType: "image",
        sport: "mma",
        technique: "jab",
        finding: "Right elbow flare",
        correction: "Keep the elbow tighter on extension and recovery.",
        severity: "medium",
        createdAt: new Date().toISOString(),
      },
    ];

    const fuelLogs: FuelLog[] = [];
    const weightLogs: WeightLog[] = [
      {
        id: "w_1",
        fighterId: "fighter_1",
        weightKg: 73.8,
        loggedAt: new Date().toISOString(),
      },
    ];

    const gymRecommendations: GymRecommendation[] = [
      {
        id: "gr_1",
        fighterId: "fighter_1",
        gymId: "gym_1",
        gymName: "Kuma Team",
        reason: "Strong match for pressure, wrestling emphasis, and serious camp environment.",
        score: 94,
        createdAt: new Date().toISOString(),
      },
    ];

    const alerts: CampAlert[] = [];

    const campState = buildCampState({
      profile,
      visionFindings,
      fuelLogs,
      weightLogs,
      gymRecommendations,
      alerts,
    });

    const response = respondAsSensei(campState, message);

    return NextResponse.json({
      ok: true,
      campState,
      response,
    });
  } catch (error) {
    console.error("Sensei chat route error:", error);
    return NextResponse.json(
      { error: "Failed to process Sensei chat request." },
      { status: 500 }
    );
  }
}