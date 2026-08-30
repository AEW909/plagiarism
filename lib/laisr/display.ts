import type { AnalysisSummary, ReviewSectionId, SectionAiReview } from "./types";

export const OUTCOMES: Array<{
  label: AnalysisSummary["recommendation"];
  description: string;
  tone: "clear" | "watch" | "moderate" | "high";
}> = [
  {
    label: "No significant indicators detected",
    description: "Checks completed without notable concern from the current evidence streams.",
    tone: "clear"
  },
  {
    label: "Examiner review recommended",
    description: "Some indicators are present and should be read by an examiner before deciding next steps.",
    tone: "watch"
  },
  {
    label: "Viva recommended",
    description: "Indicators are sufficient to make an authorship discussion proportionate.",
    tone: "moderate"
  },
  {
    label: "Strong viva recommended",
    description: "Multiple or serious indicators cluster enough to prioritise viva preparation.",
    tone: "high"
  }
];

export function aiConcernLabel(concern: SectionAiReview["concern"]) {
  return concern === "high"
    ? "High concern"
    : concern === "moderate"
      ? "Moderate concern"
      : concern === "low"
        ? "Low concern"
        : concern === "not_run"
          ? "Not run"
          : "Unavailable";
}

export function sectionLabel(sectionId: ReviewSectionId) {
  if (sectionId === "metadata") {
    return "File history checks";
  }

  if (sectionId === "textual") {
    return "Writing pattern checks";
  }

  if (sectionId === "comparative") {
    return "Known writing comparison";
  }

  if (sectionId === "ai_prose") {
    return "AI text opinion";
  }

  return "Summary";
}

export function isVivaRecommendation(recommendation: AnalysisSummary["recommendation"] | undefined) {
  return recommendation === "Viva recommended" || recommendation === "Strong viva recommended";
}
