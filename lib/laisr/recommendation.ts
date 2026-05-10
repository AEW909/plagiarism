import type { Finding, LaisrReport, VivaQuestion } from "./types";

export function buildInterpretation(findings: Finding[]) {
  if (findings.length === 0) {
    return "The algorithmic review did not identify strong academic malpractice indicators in the available document evidence.";
  }

  return "The document contains observable indicators that may warrant examiner attention. The strongest interpretation depends on whether findings cluster in the same sections and whether they are more consistent with direct copying, close paraphrase, AI-assisted rewriting, contract assistance, legitimate source use, or normal drafting. The candidate's ability to explain sources, process, and argument choices remains central.";
}

export function buildCounterArgument(findings: Finding[], recommendation: LaisrReport["summary"]["recommendation"]) {
  if (findings.length === 0) {
    return "The strongest argument for further investigation is that absence of detected indicators does not prove authorship or proper source use. Direct copying, close paraphrase, contract assistance, or AI involvement can leave few DOCX artefacts, and a polished document may still warrant discussion if external context raises concern.";
  }

  if (recommendation === "No significant indicators detected") {
    return "Although the current checks do not support escalation, a cautious examiner could still consider context outside this document, such as a sudden change from authenticated work, missing drafts, or inability to explain sources. Those concerns would need separate evidence.";
  }

  const categories = Array.from(new Set(findings.map((finding) => finding.category))).join(", ");
  return `The findings in ${categories} can have innocent explanations, including shared devices, cloud editors, templates, normal revision, legitimate quotation/paraphrase, source-heavy writing, or uneven student development. A fair review should test understanding, source handling, and process evidence before drawing conclusions.`;
}

export function buildAssessment(findings: Finding[], recommendation: string) {
  const serious = findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notable = findings.filter((finding) => finding.severity === "notable").length;
  return `${recommendation}. This assessment is based on ${serious} serious/critical and ${notable} notable algorithmic indicators. It is a triage recommendation for examiner judgment, not a misconduct verdict.`;
}

export function buildVivaQuestions(findings: Finding[], subject: string): VivaQuestion[] {
  const questions: VivaQuestion[] = [
    {
      question: `In your own words, what is the central argument of your ${subject || "essay"}?`,
      rationale: "Tests basic ownership of the submission."
    },
    {
      question: "Which source or piece of evidence most influenced your conclusion, and why?",
      rationale: "Tests research process and source understanding."
    },
    {
      question: "What changed most between your first draft and final draft?",
      rationale: "Opens space for authorship process evidence."
    }
  ];

  const rsidProcessFindings = findings.filter((finding) =>
    [
      "xml-low-rsid-diversity",
      "xml-bulk-rsid-block",
      "xml-rsid-missing-from-settings",
      "xml-rsid"
    ].includes(finding.id)
  );
  if (rsidProcessFindings.length > 0) {
    questions.push({
      question:
        "Can you talk me through exactly how this document was drafted: where you wrote the first version, whether you copied sections from notes or another file, and whether you used Word, Google Docs, a plain-text editor, or another tool?",
      rationale:
        "The DOCX edit-session pattern raises a process question. This does not prove misconduct, but it is a useful way to check whether the candidate's account of drafting fits the file evidence.",
      linkedFinding: rsidProcessFindings[0].id
    });
  }

  for (const finding of findings.slice(0, 8)) {
    questions.push({
      question: finding.vivaAngle,
      rationale: finding.evidence,
      linkedFinding: finding.id
    });
  }

  questions.push(
    {
      question: "What is the most important limitation of the evidence you reviewed?",
      rationale: "Tests methodological understanding."
    },
    {
      question: "How would you design a stronger study or investigation to answer your research question?",
      rationale: "Tests genuine subject mastery beyond the written text."
    }
  );

  return questions;
}

export function getRecommendation(seriousCount: number, notableCount: number): LaisrReport["summary"]["recommendation"] {
  if (seriousCount >= 2 || (seriousCount === 1 && notableCount >= 3)) {
    return "Strong viva recommended";
  }

  if (seriousCount === 1 || notableCount >= 4) {
    return "Viva recommended";
  }

  if (notableCount >= 2) {
    return "Examiner review recommended";
  }

  return "No significant indicators detected";
}

export function shouldRecommendViva(recommendation: LaisrReport["summary"]["recommendation"]) {
  return recommendation === "Viva recommended" || recommendation === "Strong viva recommended";
}
