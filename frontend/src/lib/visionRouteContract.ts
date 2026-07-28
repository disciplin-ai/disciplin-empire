import {
  VISION_SYSTEM_INSTRUCTION,
  validateVisionModelOutput,
  type VisionMediaEvidence,
  type VisionModelOutput,
} from "./visionGovernance";

export type VisionEvidenceRequest = {
  media: Pick<
    VisionMediaEvidence,
    "kind" | "mimeType" | "name"
  >;
  sport?: string;
  athleteContext?: string;
};

const OUTPUT_KEYS = new Set([
  "observation",
  "inference",
  "alternative",
  "uncertainty",
  "timestampStart",
  "timestampEnd",
  "confidence",
]);

export function buildVisionEvidencePrompt(
  request: VisionEvidenceRequest
) {
  const context =
    request.athleteContext?.trim();

  return [
    VISION_SYSTEM_INSTRUCTION,
    "",
    `Media kind: ${request.media.kind}`,
    `Media type: ${request.media.mimeType}`,
    `Sport: ${
      request.sport?.trim() ||
      "Not provided"
    }`,
    context
      ? `Optional athlete context (not visible evidence): ${context}`
      : "Optional athlete context: Not provided",
    "",
    "Return JSON only. Use exactly the permitted fields.",
  ].join("\n");
}

export function parseVisionEvidenceResponse(
  raw: unknown
): VisionModelOutput {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  ) {
    throw new Error(
      "Vision response must be a JSON object."
    );
  }

  const record =
    raw as Record<string, unknown>;

  const unexpected = Object.keys(
    record
  ).filter(
    (key) => !OUTPUT_KEYS.has(key)
  );

  if (unexpected.length) {
    throw new Error(
      `Vision returned fields outside its authority: ${unexpected.join(
        ", "
      )}`
    );
  }

  return validateVisionModelOutput(
    record
  );
}

export function toLegacyVisionAnalysis(
  output: VisionModelOutput,
  sport: string
) {
  return {
    sport,
    findings: [
      {
        title: output.observation,
        direct_observation:
          output.observation,
        interpretation:
          output.inference,
        alternative_interpretation:
          output.alternative,
        uncertainty:
          output.uncertainty,
        timestamp:
          output.timestampStart,
        timestamp_end:
          output.timestampEnd,
        confidence:
          output.confidence,
      },
    ],
  };
}