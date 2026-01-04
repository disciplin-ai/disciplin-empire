// app/api/analytics/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Later you can replace this with real DB queries.
  // For now it's structured like real analytics data.
  const now = new Date();

  const analytics = {
    summary: {
      trainingSessionsThisWeek: 8,
      hardSparringRounds: 15,
      avgSleepHours: 7.4,
      avgRPE: 7.8, // how hard sessions feel
    },
    readinessScore: {
      score: 82, // out of 100
      label: "Ready to push",
      factors: [
        "Good sleep last 3 nights",
        "No major injuries reported",
        "Slight fatigue from last hard sparring day",
      ],
    },
    last7Days: [
      { day: "Mon", sessions: 2, minutes: 90 },
      { day: "Tue", sessions: 1, minutes: 60 },
      { day: "Wed", sessions: 2, minutes: 100 },
      { day: "Thu", sessions: 1, minutes: 45 },
      { day: "Fri", sessions: 1, minutes: 75 },
      { day: "Sat", sessions: 1, minutes: 50 },
      { day: "Sun", sessions: 0, minutes: 0 },
    ],
    lastUpdated: now.toISOString(),
  };

  return NextResponse.json(analytics, { status: 200 });
}
