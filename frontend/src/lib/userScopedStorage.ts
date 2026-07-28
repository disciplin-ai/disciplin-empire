export const IDENTITY_CHANGED_EVENT = "disciplin:identity-changed";

export const LEGACY_USER_STORAGE_KEYS = [
  "disciplin_directive_progress",
  "disciplin_last_proof",
  "disciplin_vision_review_packet",
  "disciplin_latest_camp",
  "disciplin_latest_vision",
  "disciplin_latest_fuel",
  "disciplin_weight_logs",
  "disciplin_athlete_workflow_v1",
  "disciplin_sensei_state_v2",
  "disciplin_vision_directive",
  "disciplin_connected_gyms",
  "disciplin_saved_gyms_v1",
  "disciplin_pressure_card_v1",
  "disciplin_sensei_constitution_v1",
  "disciplin_vision_memory",
  "disciplin_profile",
  "disciplin_fighter_profile",
  "disciplin_camp_state",
  "disciplin_build_camp",
  "disciplin_recovery",
  "disciplin_fighter_context",
  "disciplin_next_fight",
  "disciplin_vision_plan_update",
  "disciplin_active_correction",
  "disciplin_vision_proof_status",
  "disciplin_next_drill",
  "disciplin_sensei_handoff",
  "disciplin_vision_fuel_relevance",
  "disciplin_latest_vision_review",
] as const;

export function userScopedStorageKey(userId: string, key: string) {
  return `disciplin:user:${userId}:${key.replace(/^disciplin[_:]/, "")}`;
}

export function developmentPreviewAllowed(authenticatedUserId: string | null, search: string, cookie: string) {
  return !authenticatedUserId && new URLSearchParams(search).get("dev") === "1" && cookie.includes("disciplin_onboarding_preview=1");
}

export function readUserJson<T>(userId: string | null | undefined, key: string): T | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(userScopedStorageKey(userId, key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeUserJson<T>(userId: string | null | undefined, key: string, value: T) {
  if (!userId || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(userScopedStorageKey(userId, key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeUserValue(userId: string | null | undefined, key: string) {
  if (!userId || typeof window === "undefined") return;
  window.localStorage.removeItem(userScopedStorageKey(userId, key));
}

export function clearLegacyUserStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_USER_STORAGE_KEYS) window.localStorage.removeItem(key);
}

export function clearUserStorage(userId: string | null | undefined) {
  if (!userId || typeof window === "undefined") return;
  const prefix = `disciplin:user:${userId}:`;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) window.localStorage.removeItem(key);
  }
}

export function announceIdentityChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(IDENTITY_CHANGED_EVENT));
}
