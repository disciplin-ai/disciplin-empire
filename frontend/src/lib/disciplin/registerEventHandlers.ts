// src/lib/disciplin/registerEventHandlers.ts

import { disciplinEvents } from "./events";

let registered = false;

export function registerDisciplinEventHandlers() {
  if (registered) return;
  registered = true;

  disciplinEvents.on("VISION_ANALYSIS_COMPLETED", async ({ fighterId }) => {
    console.log("[Disciplin] Vision analysis completed for fighter:", fighterId);

    await disciplinEvents.emit("CAMP_STATE_REFRESH_REQUESTED", {
      fighterId,
      reason: "vision-analysis-completed",
    });
  });

  disciplinEvents.on("FUEL_LOG_CREATED", async ({ fighterId }) => {
    console.log("[Disciplin] Fuel log created for fighter:", fighterId);

    await disciplinEvents.emit("CAMP_STATE_REFRESH_REQUESTED", {
      fighterId,
      reason: "fuel-log-created",
    });
  });

  disciplinEvents.on("WEIGHT_LOG_CREATED", async ({ fighterId }) => {
    console.log("[Disciplin] Weight log created for fighter:", fighterId);

    await disciplinEvents.emit("CAMP_STATE_REFRESH_REQUESTED", {
      fighterId,
      reason: "weight-log-created",
    });
  });

  disciplinEvents.on("CAMP_STATE_REFRESH_REQUESTED", async ({ fighterId, reason }) => {
    console.log(
      `[Disciplin] Refresh camp state for fighter ${fighterId}. Reason: ${reason}`
    );

    // Later:
    // 1. re-query Supabase
    // 2. rebuild camp state
    // 3. store cached camp_state row if needed
  });
}