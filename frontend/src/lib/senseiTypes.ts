// frontend/src/lib/senseiTypes.ts

export type SenseiSectionId =
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "questions";

export type SenseiConfidence = "low" | "med" | "high";

export type SenseiBlock = {
  label: string;                 // e.g. "VOLUME", "INTENSITY", "STRUCTURE"
  bullets: string[];             // 1–3, concrete
  metrics?: Record<string, string>; // optional key-value row
};

export type SenseiSection = {
  id: SenseiSectionId;
  title: string;                 // e.g. "TRAINING"
  week: string;                  // e.g. "Week 2" or "Fight Week"
  confidence: SenseiConfidence;
  blocks: SenseiBlock[];         // 3–6 blocks
};

export type SenseiResponse = {
  followups_id: string;
  sections: SenseiSection[];     // always 5 sections in correct order
};

export function senseiJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      followups_id: { type: "string" },
      sections: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "string",
              enum: ["overview", "training", "nutrition", "recovery", "questions"],
            },
            title: { type: "string" },
            week: { type: "string" },
            confidence: { type: "string", enum: ["low", "med", "high"] },
            blocks: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  bullets: {
                    type: "array",
                    minItems: 1,
                    maxItems: 3,
                    items: { type: "string" },
                  },
                  metrics: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
                required: ["label", "bullets"],
              },
            },
          },
          required: ["id", "title", "week", "confidence", "blocks"],
        },
      },
    },
    required: ["followups_id", "sections"],
  } as const;
}
