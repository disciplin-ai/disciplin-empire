export type VisionDiscipline =
  | "striking"
  | "wrestling"
  | "grappling"
  | "clinch"
  | "unknown";

export type VisionConfidence = "low" | "med" | "high";

export type VisionFindingSeverity = "LOW" | "MEDIUM" | "HIGH";

export type VisionFinding = {
  id: string;
  title: string;
  severity: VisionFindingSeverity;
  detail: string;
};

export type VisionAnalysis = {
  analysis_id: string;
  clipLabel: string;
  discipline_detected: VisionDiscipline;
  technique_detected: string;
  confidence: VisionConfidence;
  allowed_fix_family: string[];

  what_you_did_right: string[];
  primary_error: string;
  why_it_matters: string;
  one_fix: string;
  drills: string[];
  safety: string[];

  findings: VisionFinding[];
};

export type VisionAnalyzeResponse =
  | {
      ok: true;
      analysis: VisionAnalysis;
    }
  | {
      ok: false;
      error: string;
      raw?: string;
    };