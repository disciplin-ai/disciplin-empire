// src/app/api/startTrial/route.ts
import { NextResponse } from "next/server";

// Temporary in-memory "user" just for testing with your friend.
// This resets whenever the dev server restarts.
type MockUser = {
  trialActive: boolean;
  trialEnds: Date | null;
};

let mockUser: MockUser = {
  trialActive: false,
  trialEnds: null,
};

export async function POST(req: Request) {
  try {
    // If the trial is already active, block starting again
    if (mockUser.trialActive) {
      return NextResponse.json(
        {
          message: "You already used your free trial.",
        },
        { status: 400 }
      );
    }

    // Set trial end to 7 days from now
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    mockUser.trialActive = true;
    mockUser.trialEnds = endDate;

    return NextResponse.json(
      {
        message: `Your 7-day free trial has started! It ends on ${endDate.toDateString()}.`,
        trialEnds: endDate.toISOString(), // optional extra info for the frontend
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("startTrial API error:", err);
    return NextResponse.json(
      {
        error: "Something went wrong starting the trial.",
      },
      { status: 500 }
    );
  }
}

// (Optional) A GET endpoint so you can check the current trial status from the UI.
export async function GET() {
  return NextResponse.json({
    trialActive: mockUser.trialActive,
    trialEnds: mockUser.trialEnds ? mockUser.trialEnds.toISOString() : null,
  });
}
