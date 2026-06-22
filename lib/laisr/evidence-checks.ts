import type { EvidenceCheck, Finding, LaisrReport } from "./types";

const CHECK_DEFINITIONS = [
  {
    id: "package",
    label: "Package envelope",
    category: "Package Forensics",
    clearDetail:
      "Checked ZIP package member timestamps for unusually compressed rewrite patterns across core document parts."
  },
  {
    id: "metadata",
    label: "Document metadata",
    category: "Document Metadata",
    clearDetail:
      "Checked creator, last editor, created/modified dates, revision count, editing time, page count, word count, and application metadata."
  },
  {
    id: "xml",
    label: "Word XML forensics",
    category: "XML Forensics",
    clearDetail:
      "Checked edit-session marker density, paragraph-level marker distribution, pasted-session clues, hidden or white text, browser-origin font markers, tracked-formatting signals, and font diversity."
  },
  {
    id: "textual",
    label: "Textual anomalies",
    category: "Textual Anomalies",
    clearDetail:
      "Checked suspicious substitutions, structural grammar artefacts, merged compound words, and copy/paste artefacts."
  },
  {
    id: "stylometric",
    label: "Stylometric indicators",
    category: "Stylometric Indicators",
    clearDetail:
      "Checked transition phrase density, repeated opener patterns, paragraph similarity, and repeated/circular phrasing signals."
  },
  {
    id: "linguistic",
    label: "Linguistic consistency",
    category: "Linguistic Consistency",
    clearDetail:
      "Checked segment-level complexity, readability shifts, formal register spikes, and consistency against the document's own baseline."
  },
  {
    id: "relationships",
    label: "Relationships and embedded objects",
    category: "Relationships and Embedded Objects",
    clearDetail:
      "Checked relationship files, external targets, hyperlinks, embedded packages/objects, media references, and custom XML relationships."
  },
  {
    id: "comparative",
    label: "Authenticated writing comparison",
    category: "Authenticated Writing Comparison",
    clearDetail:
      "No authenticated writing sample was supplied, so LAISR could not compare this submission with known writing by the same candidate."
  },
  {
    id: "ai",
    label: "Text-only AI prose review",
    category: "Text-only AI Prose Opinion",
    clearDetail:
      "Checked whether the optional text-only AI review completed a prose-level source-use, plagiarism, paraphrasing, authorship, and AI-writing opinion before the later evidence-synthesis and judgement stages."
  }
] as const;

export function buildEvidenceChecks(
  findings: Finding[],
  aiReview: LaisrReport["aiReview"],
  comparativeProfile: LaisrReport["comparativeProfile"]
): EvidenceCheck[] {
  return CHECK_DEFINITIONS.map((definition) => {
    if (definition.id === "ai") {
      const aiIssue =
        aiReview.status === "failed" ||
        aiReview.evidenceConcern === "moderate" ||
        aiReview.evidenceConcern === "high";
      const status =
        aiReview.status === "pending" || (aiReview.enabled && aiReview.status !== "completed" && aiReview.status !== "not_configured")
          ? "pending"
          : aiReview.status === "not_configured"
            ? "not_run"
            : aiIssue
              ? "issues"
              : "clear";
      return {
        id: definition.id,
        label: definition.label,
        category: definition.category,
        status,
        summary:
          aiReview.status === "completed"
            ? aiIssue
              ? `AI reported ${aiReview.evidenceConcern} concern`
              : `AI reported ${aiReview.evidenceConcern === "none" ? "no" : "low"} concern`
            : aiReview.status === "failed"
              ? "AI text review failed"
              : aiReview.status === "pending"
                ? "AI text review pending"
                : "AI text review not configured",
        detail:
          aiReview.status === "completed"
            ? `The AI text review assessed only the visible submitted prose for direct copying, close paraphrase, source patchwriting, AI assistance, and authorship-inconsistency indicators. It returned a "${aiReview.evidenceConcern}" concern level. File-forensic and algorithmic evidence are considered separately in the synthesis stage.`
            : aiReview.status === "failed"
              ? aiReview.assessment
              : aiReview.status === "pending"
                ? "The deterministic checks have completed. The text-only AI review and later evidence synthesis are still running and will update this report when they return."
                : "The deterministic checks completed, but no text-only AI review or AI synthesis was generated because OPENAI_API_KEY was not configured.",
        findingIds: []
      };
    }

    if (definition.id === "comparative" && !comparativeProfile.available) {
      return {
        id: definition.id,
        label: definition.label,
        category: definition.category,
        status: "not_run",
        summary: "No authenticated sample supplied",
        detail: definition.clearDetail,
        findingIds: []
      };
    }

    const categoryFindings = findings.filter((finding) => finding.category === definition.category);
    const issueCount = categoryFindings.length;

    return {
      id: definition.id,
      label: definition.label,
      category: definition.category,
      status: issueCount > 0 ? "issues" : "clear",
      summary:
        issueCount > 0
          ? `${issueCount} issue${issueCount === 1 ? "" : "s"} detected`
          : "No issues detected",
      detail:
        issueCount > 0
          ? `This check produced ${issueCount} finding${issueCount === 1 ? "" : "s"} in the report. Expand the related finding cards below for evidence, benchmarks, interpretation, counter-argument, and viva angle.`
          : definition.clearDetail,
      findingIds: categoryFindings.map((finding) => finding.id)
    };
  });
}
