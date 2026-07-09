export type VisionFinding = {
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | string;

  interrupt: string;
  fix_next_rep: string;

  shot_verdict?: "REAL" | "FAKE" | string;
  finish_verdict?: "CLEAN" | "STUCK" | string;
  position_verdict?: "STABLE" | "BREAKING" | string;

  good?: string;
  unstable?: string;
  break_point?: string;

  live_rounds?: string[];

  dashboard_detail?: string;
  cost_of_delay?: string;
  if_ignored?: string;
  short_detail?: string;

  train?: string[];

  pattern_line?: string;
  repeat_offense_count?: number;

  // legacy-safe optional fields
  discipline_detected?: string;
  technique_detected?: string;
  confidence?: number;
  allowed_fix_family?: string;
};

export type VisionAnalysis = {
  analysis_id: string;
  clipLabel: string;
  summary: string;
  findings: VisionFinding[];

  // legacy-safe optional fields
  discipline_detected?: string;
  technique_detected?: string;
  confidence?: number;
  allowed_fix_family?: string;
};