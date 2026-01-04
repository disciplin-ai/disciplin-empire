// src/app/api/sensei/plan/route.ts
import { NextResponse } from "next/server";
import { openai } from "../../../../lib/openai";
import type {
  SenseiPlan,
  SenseiPlanRequest,
} from "../../../../types/sensei";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SenseiPlanRequest;
    const { profile, context } = body;

    const systemPrompt = `
You are Sensei AI — a cold, precise MMA coach.

You get:
- A fighter profile (style, stance, years training, weaknesses, injuries, etc.).
- A session context (goal, days to next fight, last session, RPE).

You output one training session ONLY, in structured JSON matching the SenseiPlan type:
{
  "warmup": string[],
  "mainRounds": [
    {
      "round": number,
      "durationSeconds": number,
      "focus": string,
      "drill": string,
      "coachingCues": string[],
      "intensity": "easy" | "moderate" | "hard" | "war"
    }
  ],
  "finisher": string,
  "notes": string[],
  "safety": string[]
}

Rules:
- Warmup: 3–6 items, specific, fight-related.
- mainRounds: 5–10 rounds, each 60–300 seconds.
- finisher: 1 hard block. Can be conditioning or technical density.
- notes: 3–6 lines explaining logic of this session.
- safety: 3–6 lines warning about injuries, volume, posture.

Training logic:
- If goal = "pressure": more pace, wrestling/cage work, less big bombs.
- If goal = "speed": sharp striking, crisp footwork, longer rest.
- If goal = "power": explosive reps, low volume, focused on form.
- If goal = "recovery": low intensity, technical drills, no war rounds.
- If goal = "mixed": balanced striking + grappling, controlled intensity.

ALWAYS return valid JSON only. No extra commentary.
`;

    const userPrompt = `
Fighter profile (JSON):
${JSON.stringify(profile, null, 2)}

Session context (JSON):
${JSON.stringify(context, null, 2)}

Generate ONE SenseiPlan for today's session.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Sensei returned empty content" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content) as SenseiPlan;
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Sensei error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
