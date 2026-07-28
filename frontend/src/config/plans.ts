export type PlanId = "trial" | "standard" | "pro";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  summary: string;
  value: string[];
  featured?: boolean;
  activationAvailable: boolean;
};

// This is the single display source for the prices already published in the app.
// Selecting a plan records preference only. Billing and trial entitlements are not
// represented as active until persistent billing infrastructure exists.
export const PLANS: readonly PlanDefinition[] = [
  {
    id: "trial",
    name: "Trial workspace",
    price: "$0",
    cadence: "No card required",
    summary: "Explore the complete athlete workflow before choosing a paid plan.",
    value: ["Dashboard, Vision, Sensei, and Fuel", "One connected athlete workspace", "Exportable fighter context"],
    activationAvailable: false,
  },
  {
    id: "standard",
    name: "Disciplin Standard",
    price: "$19.99",
    cadence: "per month",
    summary: "Carry coaching, evidence, and preparation into every session.",
    value: ["Vision evidence review", "Coach-authority workflow", "Sensei and Fuel guidance"],
    featured: true,
    activationAvailable: false,
  },
  {
    id: "pro",
    name: "Disciplin Pro",
    price: "$39.99",
    cadence: "per month",
    summary: "Add long-term pattern review and camp-level accountability.",
    value: ["Everything in Standard", "Cross-session pattern detection", "Camp-level review"],
    activationAvailable: false,
  },
] as const;

export function planById(id?: string | null) {
  return PLANS.find((plan) => plan.id === id) ?? null;
}
