import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function authenticatedCoachRequest(): Promise<
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; status: 401; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }
  return { ok: true, supabase, user };
}

const RPC_MESSAGES: Record<string, string> = {
  active_relationship_exists: "You already have a pending or connected coach.",
  authentication_required: "Sign in to continue.",
  connected_relationship_required: "An accepted coach connection is required.",
  invitation_not_available: "This invitation is no longer available.",
  invitation_not_found: "This invitation does not match the signed-in account.",
  invitation_rate_limited: "Wait before creating or resending another invitation.",
  invalid_approved_version: "The approved correction and practice task are required.",
  invalid_decision: "Choose approve, edit and approve, or reject.",
  invalid_invitation: "Check the coach details and try again.",
  invalid_previous_version: "That approved correction is no longer available.",
  invalid_submission: "Add the correction and practice task.",
  rejection_reason_required: "Add a reason before rejecting this correction.",
  relationship_not_available: "This coach connection is no longer available.",
  self_invitation_not_allowed: "Use a different account for the invited coach.",
  submission_not_available: "This correction is no longer waiting for review.",
};

export function coachRpcError(error: { message?: string; code?: string } | null | undefined) {
  const raw = String(error?.message || "");
  const key = Object.keys(RPC_MESSAGES).find((candidate) => raw.includes(candidate));
  if (key) {
    return {
      code: "COACH_REQUEST_FAILED" as const,
      message: RPC_MESSAGES[key],
      status: key.includes("rate_limited") ? 429 : 400,
      retryable: key.includes("rate_limited"),
      diagnosticRef: error?.code,
    };
  }
  if (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    raw.includes("does not exist") ||
    raw.includes("schema cache")
  ) {
    return {
      code: "COACH_SCHEMA_UNAVAILABLE" as const,
      message: "Coach connection is temporarily unavailable.",
      status: 503,
      retryable: false,
      diagnosticRef: error?.code,
    };
  }
  return {
    code: "COACH_REQUEST_FAILED" as const,
    message: "We couldn’t complete this coach action. Try again.",
    status: 500,
    retryable: true,
    diagnosticRef: error?.code,
  };
}

export function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
