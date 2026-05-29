import { buildAlgorithmicSections } from "./sections";
import type { FinalRecommendation, LaisrReport, SectionAiReview } from "./types";

const SCORE_TO_RECOMMENDATION: Array<{
  min: number;
  recommendation: FinalRecommendation["recommendation"];
}> = [
  { min: 8, recommendation: "Strong viva recommended" },
  { min: 6, recommendation: "Viva recommended" },
  { min: 4, recommendation: "Examiner review recommended" },
  { min: 0, recommendation: "No significant indicators detected" }
];

export function buildLocalFinalRecommendation(
  report: LaisrReport,
  selectedAiReviews: SectionAiReview[]
): FinalRecommendation {
  const sectionScores = buildAlgorithmicSections(report)
    .filter((section) => section.id !== "ai_prose" && section.available)
    .map((section) => algorithmicSectionScore(section.tone));
  const aiScores = selectedAiReviews
    .filter((review) => review.status === "completed" && review.concern !== "unavailable")
    .map((review) => clampScore(review.concernScore));
  const criticalCount = report.findings.filter((finding) => finding.severity === "critical").length;
  const seriousCount = report.findings.filter((finding) => finding.severity === "serious").length;
  const notableCount = report.findings.filter((finding) => finding.severity === "notable").length;
  const scores = [...sectionScores, ...aiScores];
  const average = scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : 1;
  const severityLift = Math.min(1.5, criticalCount * 0.7 + seriousCount * 0.35 + notableCount * 0.12);
  const concernScore = clampScore(Math.round(Math.max(...scores, average + severityLift)));

  return {
    source: "algorithmic",
    recommendation: recommendationFromScore(concernScore),
    concernScore,
    rationale:
      `This summary was generated without a new final AI call. It weighs the algorithmic section scores` +
      `${aiScores.length ? " and the selected completed AI concern scores" : ""}. ` +
      `The result is a triage recommendation only; it should be read alongside the underlying evidence and possible innocent explanations.`,
    includedAiSections: selectedAiReviews.map((review) => review.sectionId),
    includedFinalAiOpinion: false
  };
}

export function recommendationFromScore(score: number): FinalRecommendation["recommendation"] {
  const item = SCORE_TO_RECOMMENDATION.find((entry) => score >= entry.min);
  return item?.recommendation || "No significant indicators detected";
}

export function clampScore(score: number) {
  if (!Number.isFinite(score)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(score)));
}

function algorithmicSectionScore(tone: "clear" | "watch" | "moderate" | "high" | "not_run") {
  if (tone === "high") {
    return 8;
  }

  if (tone === "moderate") {
    return 6;
  }

  if (tone === "watch") {
    return 4;
  }

  if (tone === "clear") {
    return 1;
  }

  return 0;
}
