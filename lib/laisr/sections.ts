import type { Finding, LaisrReport, ReviewSectionId } from "./types";

export type SectionTone = "clear" | "watch" | "moderate" | "high" | "not_run";

export type AlgorithmicSection = {
  id: ReviewSectionId;
  label: string;
  description: string;
  available: boolean;
  judgement: string;
  tone: SectionTone;
  summary: string;
  findings: Finding[];
};

const SECTION_CATEGORIES: Record<Exclude<ReviewSectionId, "ai_prose" | "summary">, string[]> = {
  metadata: [
    "Document Metadata",
    "Package Forensics",
    "XML Forensics",
    "Relationships and Embedded Objects"
  ],
  textual: [
    "Textual Anomalies",
    "Stylometric Indicators",
    "Linguistic Consistency"
  ],
  comparative: [
    "Authenticated Writing Comparison"
  ]
};

export function buildAlgorithmicSections(report: LaisrReport): AlgorithmicSection[] {
  const metadataFindings = filterFindings(report.findings, SECTION_CATEGORIES.metadata);
  const textualFindings = filterFindings(report.findings, SECTION_CATEGORIES.textual);
  const comparativeFindings = filterFindings(report.findings, SECTION_CATEGORIES.comparative);

  return [
    buildSection({
      id: "metadata",
      label: "Metadata and File Forensics",
      description:
        "Document properties, version/process clues, edit-session markers, formatting artefacts, relationships, embedded objects, and XML-level provenance checks.",
      findings: metadataFindings
    }),
    buildSection({
      id: "textual",
      label: "Textual Anomalies, Tone and Style",
      description:
        "Visible textual anomalies, repeated phrasing, paragraph similarity, complexity shifts, register changes, and section-level style variation.",
      findings: textualFindings
    }),
    buildSection({
      id: "comparative",
      label: "Authenticated Writing Comparison",
      description:
        "Comparison between the submitted text and a known writing sample from the same candidate.",
      available: report.comparativeProfile.available,
      unavailableJudgement: "Not run",
      unavailableSummary: "No authenticated writing sample was supplied.",
      findings: comparativeFindings,
      fallbackSummary: report.comparativeProfile.summary
    }),
    {
      id: "ai_prose",
      label: "AI Prose Opinion",
      description:
        "Optional text-only AI opinion. This sends only the visible submitted writing, not metadata, XML, deterministic findings, or comparison metrics.",
      available: true,
      judgement: "Not run",
      tone: "not_run",
      summary: "Run this only if you want a separate prose-only AI opinion.",
      findings: []
    }
  ];
}

export function buildSummarySection(report: LaisrReport): AlgorithmicSection {
  const sections = buildAlgorithmicSections(report).filter((section) => section.id !== "ai_prose");
  const activeSections = sections.filter((section) => section.available);
  const serious = report.findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notable = report.findings.filter((finding) => finding.severity === "notable").length;
  const highSections = activeSections.filter((section) => section.tone === "high" || section.tone === "moderate").length;
  const reviewSections = activeSections.filter((section) => section.tone === "watch").length;

  return {
    id: "summary",
    label: "Summary and Recommendation",
    description:
      "Overall deterministic triage across the available sections. This remains a review recommendation, not a misconduct finding.",
    available: true,
    judgement: report.summary.recommendation,
    tone: highSections > 0 ? "moderate" : reviewSections > 0 ? "watch" : "clear",
    summary:
      `LAISR found ${serious} serious/critical and ${notable} notable deterministic indicator${serious + notable === 1 ? "" : "s"}. ` +
      "The recommendation should weigh reliability, clustering, possible innocent explanations, and whether a viva could fairly test the concern.",
    findings: report.findings
  };
}

export function sectionPayload(report: LaisrReport, sectionId: ReviewSectionId) {
  const sections = buildAlgorithmicSections(report);
  const summarySection = buildSummarySection(report);
  const section = sectionId === "summary"
    ? summarySection
    : sections.find((item) => item.id === sectionId);

  if (!section) {
    throw new Error("Unknown review section.");
  }

  if (sectionId === "comparative") {
    return {
      section: {
        id: section.id,
        label: section.label,
        description: section.description,
        available: section.available
      },
      submittedText: report.extractedTextPreview.slice(0, 9000),
      authenticatedText: report.authenticatedTextPreview?.slice(0, 9000)
    };
  }

  const aiSection = compactSectionForAi(section);

  return {
    section: aiSection,
    metadata: sectionId === "metadata" ? report.metadata : undefined,
    linguisticProfile: sectionId === "textual" ? compactLinguisticProfile(report) : undefined,
    submittedText:
      sectionId === "ai_prose"
        ? report.extractedTextPreview.slice(0, 9000)
        : undefined,
    allSections: sectionId === "summary" ? sections.map(compactSectionForAi) : undefined
  };
}

function compactSectionForAi(section: AlgorithmicSection): AlgorithmicSection {
  return {
    ...section,
    findings: section.findings.slice(0, 24).map((finding) => ({
      ...finding,
      evidence: clip(finding.evidence, 500),
      interpretation: clip(finding.interpretation, 500),
      counterArgument: clip(finding.counterArgument, 400),
      vivaAngle: clip(finding.vivaAngle, 300)
    }))
  };
}

function compactLinguisticProfile(report: LaisrReport) {
  const profile = report.linguisticProfile;

  return {
    meanFkGrade: profile.meanFkGrade,
    meanFogIndex: profile.meanFogIndex,
    meanFormalDensity: profile.meanFormalDensity,
    meanPassiveDensity: profile.meanPassiveDensity,
    consistencyScore: profile.consistencyScore,
    consistencyLabel: profile.consistencyLabel,
    segments: profile.segments.map((segment) => ({
      index: segment.index,
      fkGrade: segment.fkGrade,
      fogIndex: segment.fogIndex,
      formalDensity: segment.formalDensity,
      passiveDensity: segment.passiveDensity,
      complexityBand: segment.complexityBand,
      registerBand: segment.registerBand,
      passiveBand: segment.passiveBand,
      opening: clip(segment.opening, 180)
    }))
  };
}

function clip(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length - 3)}...`;
}

function buildSection({
  available = true,
  description,
  fallbackSummary,
  findings,
  id,
  label,
  unavailableJudgement,
  unavailableSummary
}: {
  id: ReviewSectionId;
  label: string;
  description: string;
  available?: boolean;
  unavailableJudgement?: string;
  unavailableSummary?: string;
  fallbackSummary?: string;
  findings: Finding[];
}): AlgorithmicSection {
  if (!available) {
    return {
      id,
      label,
      description,
      available: false,
      judgement: unavailableJudgement || "Not run",
      tone: "not_run",
      summary: unavailableSummary || "This section was not run.",
      findings: []
    };
  }

  const critical = findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notable = findings.filter((finding) => finding.severity === "notable").length;
  const info = findings.filter((finding) => finding.severity === "info").length;
  const tone: SectionTone =
    critical > 0 ? "high" : notable >= 3 ? "moderate" : notable > 0 ? "watch" : "clear";
  const judgement =
    tone === "high"
      ? "Significant indicators"
      : tone === "moderate"
        ? "Multiple review indicators"
        : tone === "watch"
          ? "Limited review indicators"
          : "No significant indicators";

  return {
    id,
    label,
    description,
    available: true,
    judgement,
    tone,
    summary:
      fallbackSummary ||
      `${critical} serious/critical, ${notable} notable, and ${info} informational finding${findings.length === 1 ? "" : "s"} in this section.`,
    findings
  };
}

function filterFindings(findings: Finding[], categories: string[]) {
  return findings.filter((finding) => categories.includes(finding.category));
}
