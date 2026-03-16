// src/lib/report/buildFighterReport.ts

export type ReportSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ReportFinding = {
  id?: string;
  title: string;
  detail: string;
  severity: ReportSeverity;
};

export type FighterReportInput = {
  fighterName?: string | null;
  baseArt?: string | null;
  stance?: string | null;
  secondaryArts?: string[];
  paceStyle?: string | null;
  pressurePreference?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  fightDate?: string | null;
  findings?: ReportFinding[];
};

export type FighterScoreKey =
  | "strikingIQ"
  | "defensiveAwareness"
  | "wrestlingChains"
  | "cardioPace";

export type FighterScores = {
  strikingIQ: number;
  defensiveAwareness: number;
  wrestlingChains: number;
  cardioPace: number;
};

export type FighterReport = {
  athleteName: string;
  styleLabel: string;
  baseArtLabel: string;
  scores: FighterScores;
  mainMistake: string;
  keyCorrection: string;
  nextDirective: string;
  summary: string;
  generatedAt: string;
};

function clampScore(value: number): number {
  return Math.max(45, Math.min(99, Math.round(value)));
}

function getSeverityPenalty(severity: ReportSeverity): number {
  if (severity === "HIGH") return 10;
  if (severity === "MEDIUM") return 6;
  return 3;
}

function buildStyleLabel(input: FighterReportInput): string {
  const pressure = (input.pressurePreference ?? "").trim();
  const pace = (input.paceStyle ?? "").trim();

  if (pressure && pace) {
    return `${pressure} ${pace}`.trim();
  }

  if (pressure) return pressure;
  if (pace) return pace;

  if ((input.baseArt ?? "").toLowerCase() === "wrestling") {
    return "Pressure Wrestler";
  }

  if ((input.baseArt ?? "").toLowerCase() === "boxing") {
    return "Pressure Boxer";
  }

  return "All-Round Fighter";
}

function buildBaseArtLabel(baseArt?: string | null) {
  if (!baseArt) return "Not Set";

  return baseArt
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMainMistake(findings: ReportFinding[]): string {
  if (!findings.length) {
    return "No major error recorded yet. Upload more sparring to generate a stricter correction report.";
  }

  return findings[0].title;
}

function buildKeyCorrection(findings: ReportFinding[]): string {
  if (!findings.length) {
    return "Upload a clip so Vision can assign a technical correction.";
  }

  return findings[0].detail;
}

function buildNextDirective(input: FighterReportInput, findings: ReportFinding[]): string {
  const baseArt = (input.baseArt ?? "").toLowerCase();

  if (findings.length > 0) {
    const top = findings[0];

    if (top.severity === "HIGH") {
      return `Fix ${top.title.toLowerCase()} first. Build 20–40 minutes of strict technical reps around that error before adding harder rounds.`;
    }

    return `Turn ${top.title.toLowerCase()} into the first technical block of your next session. Reps first, then pressure.`;
  }

  if (baseArt === "wrestling" || baseArt === "sambo" || baseArt === "judo") {
    return "Build the next session around entries, re-attacks, and finishing pressure.";
  }

  if (baseArt === "boxing" || baseArt === "kickboxing" || baseArt === "muay-thai") {
    return "Build the next session around one technical striking theme and repeat it under pace.";
  }

  return "Choose one technical theme and train it for reps before harder rounds.";
}

function scoreStrikingIQ(input: FighterReportInput, findings: ReportFinding[]): number {
  let score = 76;

  const baseArt = (input.baseArt ?? "").toLowerCase();
  const secondaries = (input.secondaryArts ?? []).map((x) => x.toLowerCase());

  if (["boxing", "kickboxing", "muay-thai", "mma"].includes(baseArt)) score += 6;
  if (secondaries.some((x) => ["boxing", "kickboxing", "muay-thai"].includes(x))) score += 4;
  if ((input.strengths ?? "").toLowerCase().includes("strik")) score += 4;
  if ((input.weaknesses ?? "").toLowerCase().includes("strik")) score -= 6;

  for (const finding of findings) {
    if (
      finding.title.toLowerCase().includes("guard") ||
      finding.title.toLowerCase().includes("jab") ||
      finding.title.toLowerCase().includes("entry") ||
      finding.title.toLowerCase().includes("chin")
    ) {
      score -= getSeverityPenalty(finding.severity);
    }
  }

  return clampScore(score);
}

function scoreDefensiveAwareness(input: FighterReportInput, findings: ReportFinding[]): number {
  let score = 74;

  if ((input.strengths ?? "").toLowerCase().includes("defen")) score += 4;
  if ((input.weaknesses ?? "").toLowerCase().includes("defen")) score -= 6;

  for (const finding of findings) {
    if (
      finding.title.toLowerCase().includes("over") ||
      finding.title.toLowerCase().includes("open") ||
      finding.title.toLowerCase().includes("defen") ||
      finding.title.toLowerCase().includes("guard")
    ) {
      score -= getSeverityPenalty(finding.severity);
    }
  }

  return clampScore(score);
}

function scoreWrestlingChains(input: FighterReportInput, findings: ReportFinding[]): number {
  let score = 72;

  const baseArt = (input.baseArt ?? "").toLowerCase();
  const secondaries = (input.secondaryArts ?? []).map((x) => x.toLowerCase());

  if (["wrestling", "sambo", "judo", "mma"].includes(baseArt)) score += 8;
  if (secondaries.some((x) => ["wrestling", "sambo", "judo"].includes(x))) score += 5;
  if ((input.strengths ?? "").toLowerCase().includes("grappl")) score += 4;
  if ((input.strengths ?? "").toLowerCase().includes("wrest")) score += 4;
  if ((input.weaknesses ?? "").toLowerCase().includes("grappl")) score -= 6;
  if ((input.weaknesses ?? "").toLowerCase().includes("wrest")) score -= 6;

  for (const finding of findings) {
    if (
      finding.title.toLowerCase().includes("sprawl") ||
      finding.title.toLowerCase().includes("hip") ||
      finding.title.toLowerCase().includes("entry") ||
      finding.title.toLowerCase().includes("attack")
    ) {
      score -= getSeverityPenalty(finding.severity);
    }
  }

  return clampScore(score);
}

function scoreCardioPace(input: FighterReportInput, findings: ReportFinding[]): number {
  let score = 75;

  const pressure = (input.pressurePreference ?? "").toLowerCase();
  const pace = (input.paceStyle ?? "").toLowerCase();

  if (pressure.includes("pressure")) score += 4;
  if (pace.includes("high")) score += 5;
  if ((input.strengths ?? "").toLowerCase().includes("cardio")) score += 5;
  if ((input.weaknesses ?? "").toLowerCase().includes("cardio")) score -= 8;

  const currentWeight = input.currentWeight ?? null;
  const targetWeight = input.targetWeight ?? null;

  if (
    typeof currentWeight === "number" &&
    typeof targetWeight === "number" &&
    currentWeight - targetWeight > 4
  ) {
    score -= 4;
  }

  for (const finding of findings) {
    if (
      finding.title.toLowerCase().includes("fatigue") ||
      finding.title.toLowerCase().includes("pace")
    ) {
      score -= getSeverityPenalty(finding.severity);
    }
  }

  return clampScore(score);
}

function buildSummary(report: {
  athleteName: string;
  styleLabel: string;
  baseArtLabel: string;
  mainMistake: string;
  nextDirective: string;
}) {
  return `${report.athleteName} — ${report.styleLabel}. Base art: ${report.baseArtLabel}. Main mistake: ${report.mainMistake}. Next directive: ${report.nextDirective}`;
}

export function buildFighterReport(input: FighterReportInput): FighterReport {
  const findings = [...(input.findings ?? [])].sort((a, b) => {
    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return weight[b.severity] - weight[a.severity];
  });

  const athleteName = (input.fighterName ?? "").trim() || "Unnamed Fighter";
  const styleLabel = buildStyleLabel(input);
  const baseArtLabel = buildBaseArtLabel(input.baseArt);

  const scores: FighterScores = {
    strikingIQ: scoreStrikingIQ(input, findings),
    defensiveAwareness: scoreDefensiveAwareness(input, findings),
    wrestlingChains: scoreWrestlingChains(input, findings),
    cardioPace: scoreCardioPace(input, findings),
  };

  const mainMistake = buildMainMistake(findings);
  const keyCorrection = buildKeyCorrection(findings);
  const nextDirective = buildNextDirective(input, findings);

  const summary = buildSummary({
    athleteName,
    styleLabel,
    baseArtLabel,
    mainMistake,
    nextDirective,
  });

  return {
    athleteName,
    styleLabel,
    baseArtLabel,
    scores,
    mainMistake,
    keyCorrection,
    nextDirective,
    summary,
    generatedAt: new Date().toISOString(),
  };
}