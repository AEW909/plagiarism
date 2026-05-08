import type { ExtractedDocx } from "./docx";
import type { EvidenceCheck, Finding, LaisrReport, VivaQuestion } from "./types";

type ReportInput = {
  doc: ExtractedDocx;
  candidateId: string;
  subject: string;
  aiReview: LaisrReport["aiReview"];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with"
]);

const SUBSTITUTION_PATTERNS = [
  {
    pattern: /\bsolicitor\b/gi,
    context: ["population", "study", "association", "relationship"],
    severity: "critical" as const,
    label: "solicitor"
  },
  {
    pattern: /\bimprovise[sd]?\b/gi,
    context: ["function", "endothelial", "outcome", "clinical"],
    severity: "critical" as const,
    label: "improvise"
  },
  {
    pattern: /\brise\b/gi,
    context: ["periodontal", "disease", "cvd", "pd"],
    severity: "critical" as const,
    label: "rise"
  },
  {
    pattern: /\bprocure[sd]?\b/gi,
    context: ["data", "evidence", "result", "sample"],
    severity: "notable" as const,
    label: "procure"
  },
  {
    pattern: /\bconceive[sd]?\b/gi,
    context: ["study", "trial", "designed", "method"],
    severity: "notable" as const,
    label: "conceive"
  },
  {
    pattern: /\bcomprehend(?:ed|s)?\b/gi,
    context: ["result", "finding", "data", "association"],
    severity: "notable" as const,
    label: "comprehend"
  }
];

const TRANSITIONS = [
  "however",
  "nevertheless",
  "nonetheless",
  "conversely",
  "on the other hand",
  "in contrast",
  "furthermore",
  "moreover",
  "in addition",
  "additionally",
  "therefore",
  "consequently",
  "thus",
  "hence",
  "as a result",
  "although",
  "despite",
  "notwithstanding",
  "importantly",
  "notably",
  "significantly",
  "crucially",
  "it is worth noting",
  "it should be noted",
  "in conclusion",
  "in summary",
  "overall",
  "taken together"
];

const FORMAL_ACADEMIC = [
  "utilise",
  "utilize",
  "demonstrate",
  "indicate",
  "facilitate",
  "encompass",
  "necessitate",
  "predominantly",
  "substantiate",
  "elucidate",
  "corroborate",
  "delineate",
  "ascertain",
  "paramount",
  "aforementioned",
  "notwithstanding",
  "constitutes",
  "pertaining",
  "whilst"
];

const COMMON_WORDS = new Set([
  "based",
  "quality",
  "level",
  "scale",
  "tail",
  "term",
  "laboratory",
  "high",
  "lower",
  "large",
  "long",
  "short",
  "data",
  "study",
  "work",
  "paper",
  "review",
  "method",
  "source",
  "student",
  "written",
  "writing"
]);

export function buildReport(input: ReportInput): LaisrReport {
  const findings = [
    ...analyseMetadata(input.doc),
    ...analyseXml(input.doc),
    ...analyseTextual(input.doc),
    ...analyseStylometric(input.doc),
    ...analyseLinguistic(input.doc)
  ];
  const seriousCount = findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notableCount = findings.filter((finding) => finding.severity === "notable").length;
  const recommendation = getRecommendation(seriousCount, notableCount);
  const vivaQuestions = shouldRecommendViva(recommendation)
    ? buildVivaQuestions(findings, input.subject)
    : [];
  const evidenceChecks = buildEvidenceChecks(findings, input.aiReview);

  return {
    summary: {
      fileName: input.doc.fileName,
      candidateId: input.candidateId || "N/A",
      subject: input.subject || "N/A",
      wordCount: tokenize(input.doc.text).length,
      paragraphCount: input.doc.paragraphs.length,
      seriousCount,
      notableCount,
      recommendation
    },
    metadata: input.doc.metadata,
    evidenceChecks,
    findings,
    interpretation: buildInterpretation(findings),
    counterArgument: buildCounterArgument(findings, recommendation),
    assessment: buildAssessment(findings, recommendation),
    vivaQuestions: shouldRecommendViva(recommendation)
      ? [...vivaQuestions, ...input.aiReview.vivaQuestions]
      : [],
    aiReview: input.aiReview,
    extractedTextPreview: input.doc.text.slice(0, 1400)
  };
}

const CHECK_DEFINITIONS = [
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
      "Checked RSID distribution, hidden or white text, browser-origin font markers, tracked-formatting signals, and font diversity."
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
    id: "ai",
    label: "AI textual review",
    category: "AI Textual Review",
    clearDetail:
      "Checked whether the optional AI interpretation layer completed and contributed review, counter-argument, assessment, and viva-question support."
  }
] as const;

function buildEvidenceChecks(findings: Finding[], aiReview: LaisrReport["aiReview"]): EvidenceCheck[] {
  return CHECK_DEFINITIONS.map((definition) => {
    if (definition.id === "ai") {
      const aiIssue = aiReview.status === "failed";
      return {
        id: definition.id,
        label: definition.label,
        category: definition.category,
        status: aiIssue ? "issues" : "clear",
        summary:
          aiReview.status === "completed"
            ? "AI review completed"
            : aiReview.status === "failed"
              ? "AI review failed"
              : aiReview.status === "pending"
                ? "AI review in progress"
              : "AI review not configured",
        detail:
          aiReview.status === "completed"
            ? "The AI layer reviewed the text and algorithmic findings to provide interpretation, counter-argument, assessment, and viva-question support."
            : aiReview.status === "failed"
              ? aiReview.assessment
              : aiReview.status === "pending"
                ? "The deterministic checks have completed. The AI interpretation layer is still running and will update this report when it returns."
              : "The deterministic checks completed, but no AI opinion was generated because OPENAI_API_KEY was not configured.",
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

function analyseMetadata(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const { metadata } = doc;
  const pages = parseInt(metadata.pages, 10);
  const revisions = parseInt(metadata.revision, 10);

  if (metadata.creator !== "N/A" && metadata.lastModifiedBy !== "N/A" && metadata.creator !== metadata.lastModifiedBy) {
    findings.push(makeFinding("metadata-author", "Document Metadata", "notable", "Creator differs from last editor", `The document creator is listed as "${metadata.creator}", while the last modified by field is "${metadata.lastModifiedBy}".`, "Document properties", "This may indicate that the document was edited on another account or device.", "Shared devices, school computers, template files, or legitimate support workflows can produce this mismatch.", "Ask the candidate to describe where the document was drafted and edited."));
  }

  if (Number.isFinite(revisions) && Number.isFinite(pages) && pages <= 20 && revisions > 200) {
    findings.push(makeFinding("metadata-revisions", "Document Metadata", "notable", "High revision count", `The document reports ${revisions} revisions across ${pages} pages.`, "Expected: revision counts vary widely, but this check flags >200 revisions for documents of 20 pages or fewer.", "Document properties", "A very high revision count can be consistent with repeated automated saves or extensive copy/edit cycles.", "Cloud editors and autosave behaviour can inflate revision counts without indicating misconduct.", "Ask the candidate to talk through their drafting process and available version history."));
  }

  return findings;
}

function analyseXml(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const paragraphs = doc.documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const rsids = [...doc.documentXml.matchAll(/w:rsidR="([^"]+)"/g)].map((match) => match[1]);
  const uniqueRsids = new Set(rsids);
  const wordCount = tokenize(doc.text).length;

  if ((wordCount < 8000 && uniqueRsids.size > 80) || uniqueRsids.size > 150) {
    findings.push(makeFinding("xml-rsid", "XML Forensics", "notable", "Unusually varied edit-session identifiers", `The DOCX XML contains ${uniqueRsids.size} unique rsidR values across ${paragraphs.length || 1} paragraphs.`, "Expected: no fixed universal norm; this check flags >80 unique RSIDs under 8,000 words, and >150 unique RSIDs unconditionally.", "word/document.xml", "High RSID variety can be consistent with content assembled across multiple edit sessions or sources.", "Normal Word autosave, collaborative editing, and long editing histories can also increase RSID variety.", "Ask the candidate to explain how the document evolved and whether they can show drafts or version history."));
  }

  paragraphs.forEach((paragraphXml, paragraphIndex) => {
    const runs = paragraphXml.match(/<w:r[\s\S]*?<\/w:r>/g) ?? [];
    const visibleText = extractTextFromXml(paragraphXml);

    for (const run of runs) {
      const runText = extractTextFromXml(run);
      if (!runText.trim()) {
        continue;
      }

      if (/w:val="(?:FFFFFF|ffffff)"/.test(run) || /<w:vanish\b/.test(run)) {
        findings.push(makeFinding(`xml-hidden-${paragraphIndex}`, "XML Forensics", "critical", "Hidden or white text detected", `Hidden or white-coloured text appears in paragraph ${paragraphIndex + 1}: "${clip(runText, 120)}".`, "Expected: visible assessment text should not normally include hidden runs or white-on-white content.", `Paragraph ${paragraphIndex + 1}`, "Hidden text can indicate concealed content or pasted material not intended to be visible to the examiner.", "Some accessibility tools, templates, or accidental formatting changes can create hidden runs.", "Ask the candidate to explain this paragraph and how the hidden text entered the document."));
      }

      const fontMatches = [...run.matchAll(/w:(?:ascii|hAnsi|cs|eastAsia)="([^"]+)"/g)];
      for (const fontMatch of fontMatches) {
        const font = fontMatch[1];
        if (/webkit|apple|-apple-system|BlinkMacSystemFont/i.test(font)) {
          findings.push(makeFinding(`xml-browser-font-${paragraphIndex}-${font}`, "XML Forensics", "critical", "Browser-origin font marker detected", `The font marker "${font}" appears near: "${clip(visibleText, 140)}".`, "Expected: Word-authored text normally uses document fonts such as Aptos, Calibri, Times New Roman, Arial, or theme fonts rather than CSS/browser font markers.", `Paragraph ${paragraphIndex + 1}`, "Browser-origin font markers may indicate pasted content from a web page, browser editor, or generated HTML source.", "Google Docs, Word Online, learning platforms, or copied legitimate notes can leave browser-origin formatting.", "Ask the candidate to explain the claim in this paragraph and whether any web editor or pasted notes were used."));
        }
      }
    }
  });

  const fontNames = new Set([...doc.documentXml.matchAll(/w:ascii="([^"]+)"/g)].map((match) => match[1]).filter((font) => !/minor|major|theme/i.test(font)));
  if (fontNames.size > 4) {
    findings.push(makeFinding("xml-font-diversity", "XML Forensics", "notable", "High font diversity", `The document uses ${fontNames.size} named fonts: ${Array.from(fontNames).slice(0, 8).join(", ")}.`, "Expected: many essays use 1-3 named fonts; this check flags more than 4 distinct named fonts after excluding theme defaults.", "word/document.xml", "Multiple fonts can be consistent with content pasted from several sources.", "Templates, headings, bibliographies, and normal formatting changes can legitimately use several fonts.", "Ask the candidate to describe their drafting and formatting process."));
  }

  return findings;
}

function analyseTextual(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const lowered = doc.text.toLowerCase();
  const tokens = tokenize(doc.text);

  for (const item of SUBSTITUTION_PATTERNS) {
    for (const match of doc.text.matchAll(item.pattern)) {
      const index = match.index ?? 0;
      const windowText = doc.text.slice(Math.max(0, index - 140), index + 140).toLowerCase();
      if (item.context.some((word) => windowText.includes(word.toLowerCase()))) {
        findings.push(makeFinding(`text-sub-${item.label}-${index}`, "Textual Anomalies", item.severity, `Suspicious word substitution: ${item.label}`, `The word or phrase "${match[0]}" appears in a context where it may be a semantically inappropriate substitution: "${clip(sentenceAround(doc.text, index), 220)}".`, "Text body", "This can be consistent with paraphrasing software, mistranslation, or AI-assisted rewriting that selected the wrong synonym.", "It may also be a typographical error, a subject-specific use of the word, or an editing mistake.", "Ask the candidate to define the intended concept and explain why that word was used."));
      }
    }
  }

  if (/\bthe studies is\b/i.test(doc.text)) {
    findings.push(makeFinding("text-studies-is", "Textual Anomalies", "notable", "Subject-verb disagreement", "The phrase \"the studies is\" appears in the document.", "Text body", "Basic grammatical inconsistency can be a copy/edit artefact when surrounded by otherwise polished prose.", "Students can make ordinary grammar mistakes, especially after rearranging sentences.", "Ask the candidate to explain the surrounding sentence in their own words."));
  }

  for (const known of ["laboratorybased", "highquality", "lowerlevel", "largescale", "longtail", "shortterm", "longterm"]) {
    if (lowered.includes(known)) {
      findings.push(makeFinding(`text-merge-${known}`, "Textual Anomalies", "notable", `Merged compound word: ${known}`, `The token "${known}" appears without the expected space or hyphen.`, "Text body", "Merged compound words can occur when text is copied from a PDF or transformed by an automated tool.", "They can also be simple typing or formatting mistakes.", "Ask the candidate where this term came from and how it was edited."));
    }
  }

  for (const token of new Set(tokens.filter((token) => token.length >= 9))) {
    const split = findCompoundSplit(token);
    if (split) {
      findings.push(makeFinding(`text-compound-${token}`, "Textual Anomalies", "notable", `Possible merged words: ${token}`, `The token "${token}" appears to combine "${split[0]}" and "${split[1]}".`, "Text body", "Merged words can be a sign of PDF extraction, copy-paste artefacts, or automated rewriting.", "This can also arise from ordinary typing errors.", "Ask the candidate to explain the source and editing of the sentence containing this term."));
    }
  }

  return findings.slice(0, 20);
}

function analyseStylometric(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const wordCount = Math.max(1, tokenize(doc.text).length);
  const lowered = doc.text.toLowerCase();
  const transitionCount = TRANSITIONS.reduce((sum, phrase) => sum + countOccurrences(lowered, phrase), 0);
  const transitionDensity = (transitionCount / wordCount) * 1000;

  if (transitionDensity > 10) {
    findings.push(makeFinding("style-transitions", "Stylometric Indicators", "notable", "High formal transition density", `The text uses ${transitionCount} formal transition phrases, around ${transitionDensity.toFixed(1)} per 1,000 words.`, "Expected: varies by essay type; this check flags >10 formal transition phrases per 1,000 words.", "Whole document", "Dense formal transitions can be consistent with AI-assisted academic prose or heavy paraphrasing.", "Some topics and strong academic writing styles naturally use frequent transitions.", "Ask the candidate to explain how they structured the argument and why these transitions were chosen."));
  }

  const paragraphs = doc.paragraphs.filter((paragraph) => tokenize(paragraph).length >= 60);
  for (let left = 0; left < paragraphs.length; left += 1) {
    for (let right = left + 1; right < paragraphs.length; right += 1) {
      const score = ngramJaccard(paragraphs[left], paragraphs[right], 5);
      if (score > 0.25) {
        findings.push(makeFinding(`style-near-dup-${left}-${right}`, "Stylometric Indicators", score > 0.45 ? "critical" : "notable", "Near-duplicate paragraph pair", `Paragraphs ${left + 1} and ${right + 1} share a five-gram similarity score of ${score.toFixed(2)}.`, "Expected: unrelated paragraphs are usually close to 0.00; this check flags >0.25 as notable and >0.45 as critical.", `Paragraphs ${left + 1} and ${right + 1}`, "Near-duplicate paragraphs can indicate circular restatement, patchwriting, or generated filler.", "A literature review may legitimately revisit similar concepts in different sections.", "Ask the candidate to explain the difference between the two paragraphs and why both are needed."));
      }
    }
  }

  const sentences = splitSentences(doc.text);
  const patternedOpeners = sentences.filter((sentence) => /^(this|these)\s+\w+|^such\s+\w+|^it is\s+\w+|^there (is|are)\b/i.test(sentence)).length;
  if (sentences.length && patternedOpeners / sentences.length > 0.18) {
    findings.push(makeFinding("style-openers", "Stylometric Indicators", "notable", "Repeated sentence-opening pattern", `${patternedOpeners} of ${sentences.length} sentences begin with a small set of formal opener patterns.`, "Expected: varied prose usually keeps these opener patterns below 18% of sentences; this check flags >18%.", "Whole document", "Repetitive sentence openings can be consistent with templated or AI-assisted prose.", "A student may also have a repetitive but genuine writing style.", "Ask the candidate to explain how they revised sentence variety."));
  }

  return findings.slice(0, 18);
}

function analyseLinguistic(doc: ExtractedDocx): Finding[] {
  const segments = segmentText(doc.text, 150);
  const findings: Finding[] = [];
  const metrics = segments.map((segment) => ({
    text: segment,
    fk: estimateGrade(segment),
    formalDensity: density(segment, FORMAL_ACADEMIC)
  }));
  const meanGrade = mean(metrics.map((metric) => metric.fk));
  const sdGrade = sd(metrics.map((metric) => metric.fk), meanGrade);
  const meanFormal = mean(metrics.map((metric) => metric.formalDensity));
  const sdFormal = sd(metrics.map((metric) => metric.formalDensity), meanFormal);

  metrics.forEach((metric, index) => {
    if (sdGrade > 0 && Math.abs(metric.fk - meanGrade) > sdGrade * 1.8) {
      const direction = metric.fk > meanGrade ? "more complex" : "simpler";
      findings.push(makeFinding(`ling-grade-${index}`, "Linguistic Consistency", "notable", `Complexity shift in segment ${index + 1}`, `Segment ${index + 1} is ${direction} than the document average. Estimated grade: ${metric.fk.toFixed(1)}; document mean: ${meanGrade.toFixed(1)}. Opening: "${clip(metric.text, 180)}".`, "Expected: segment complexity should normally sit within about 1.8 standard deviations of the document mean; this check flags larger deviations.", `Segment ${index + 1}`, "A sharp complexity shift can suggest a different drafting source or a pasted section.", "Students often vary in complexity between introduction, evidence review, and conclusion sections.", "Ask the candidate to explain the argument in this segment and how it was drafted."));
    }

    if (sdFormal > 0 && metric.formalDensity > meanFormal + sdFormal * 2) {
      findings.push(makeFinding(`ling-register-${index}`, "Linguistic Consistency", "notable", `Formal register spike in segment ${index + 1}`, `Segment ${index + 1} has a formal academic vocabulary density of ${metric.formalDensity.toFixed(1)} per 100 words. Opening: "${clip(metric.text, 180)}".`, "Expected: formal vocabulary density should usually track the document's own baseline; this check flags segments more than 2 standard deviations above the document mean.", `Segment ${index + 1}`, "A local register spike can indicate inserted or heavily AI-assisted academic prose.", "A source-heavy section or a carefully revised paragraph may legitimately become more formal.", "Ask the candidate to explain the technical terms and how the paragraph was developed."));
    }
  });

  return findings.slice(0, 12);
}

function makeFinding(id: string, category: string, severity: Finding["severity"], title: string, evidence: string, normalRangeOrLocation: string, locationOrInterpretation: string, interpretationOrCounterArgument: string, counterArgumentOrVivaAngle: string, vivaAngle?: string): Finding {
  if (vivaAngle === undefined) {
    return {
      id,
      category,
      severity,
      title,
      evidence,
      location: normalRangeOrLocation,
      interpretation: locationOrInterpretation,
      counterArgument: interpretationOrCounterArgument,
      vivaAngle: counterArgumentOrVivaAngle
    };
  }

  return {
    id,
    category,
    severity,
    title,
    evidence,
    normalRange: normalRangeOrLocation,
    location: locationOrInterpretation,
    interpretation: interpretationOrCounterArgument,
    counterArgument: counterArgumentOrVivaAngle,
    vivaAngle
  };
}

function buildInterpretation(findings: Finding[]) {
  if (findings.length === 0) {
    return "The algorithmic review did not identify strong integrity indicators in the available document evidence.";
  }

  return "The document contains observable indicators that may warrant examiner attention. The strongest interpretation depends on whether findings cluster in the same sections and whether the candidate can explain the drafting process, sources, and argument choices in viva.";
}

function buildCounterArgument(findings: Finding[], recommendation: LaisrReport["summary"]["recommendation"]) {
  if (findings.length === 0) {
    return "The strongest argument for further investigation is that absence of detected indicators does not prove authorship. AI involvement can leave few DOCX artefacts, paraphrased assistance may not trigger textual checks, and a polished document may still warrant discussion if external context raises concern.";
  }

  if (recommendation === "No significant indicators detected") {
    return "Although the current checks do not support escalation, a cautious examiner could still consider context outside this document, such as a sudden change from authenticated work, missing drafts, or inability to explain sources. Those concerns would need separate evidence.";
  }

  const categories = Array.from(new Set(findings.map((finding) => finding.category))).join(", ");
  return `The findings in ${categories} can have innocent explanations, including shared devices, cloud editors, templates, normal revision, legitimate source use, or uneven student writing. A fair review should test understanding and process evidence before drawing conclusions.`;
}

function buildAssessment(findings: Finding[], recommendation: string) {
  const serious = findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notable = findings.filter((finding) => finding.severity === "notable").length;
  return `${recommendation}. This assessment is based on ${serious} serious/critical and ${notable} notable algorithmic indicators. It is a triage recommendation for examiner judgment, not a misconduct verdict.`;
}

function buildVivaQuestions(findings: Finding[], subject: string): VivaQuestion[] {
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

function getRecommendation(seriousCount: number, notableCount: number): LaisrReport["summary"]["recommendation"] {
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

function shouldRecommendViva(recommendation: LaisrReport["summary"]["recommendation"]) {
  return recommendation === "Viva recommended" || recommendation === "Strong viva recommended";
}

function tokenize(text: string) {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
}

function extractTextFromXml(xml: string) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function clip(value: string, length: number) {
  const normalised = value.replace(/\s+/g, " ").trim();
  return normalised.length <= length ? normalised : `${normalised.slice(0, length - 1)}...`;
}

function sentenceAround(text: string, index: number) {
  const start = text.lastIndexOf(".", index);
  const end = text.indexOf(".", index);
  return text.slice(start === -1 ? 0 : start + 1, end === -1 ? index + 220 : end + 1).trim();
}

function findCompoundSplit(token: string): [string, string] | null {
  for (let index = 4; index <= token.length - 4; index += 1) {
    const left = token.slice(0, index);
    const right = token.slice(index);
    if (COMMON_WORDS.has(left) && COMMON_WORDS.has(right)) {
      return [left, right];
    }
  }

  return null;
}

function countOccurrences(text: string, phrase: string) {
  return text.match(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"))?.length ?? 0;
}

function ngramJaccard(left: string, right: string, size: number) {
  const leftSet = new Set(ngrams(tokenize(left).filter((token) => !STOP_WORDS.has(token)), size));
  const rightSet = new Set(ngrams(tokenize(right).filter((token) => !STOP_WORDS.has(token)), size));
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function ngrams(tokens: string[], size: number) {
  const output: string[] = [];
  for (let index = 0; index <= tokens.length - size; index += 1) {
    output.push(tokens.slice(index, index + size).join(" "));
  }
  return output;
}

function segmentText(text: string, targetWords: number) {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => tokenize(paragraph).length >= 5);
  const segments: string[] = [];
  let current: string[] = [];
  let count = 0;

  for (const paragraph of paragraphs) {
    const words = tokenize(paragraph).length;
    current.push(paragraph);
    count += words;
    if (count >= targetWords) {
      segments.push(current.join("\n\n"));
      current = [];
      count = 0;
    }
  }

  if (current.length) {
    segments.push(current.join("\n\n"));
  }

  return segments;
}

function estimateGrade(text: string) {
  const words = tokenize(text);
  const sentences = splitSentences(text);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  if (words.length === 0 || sentences.length === 0) {
    return 0;
  }
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
}

function countSyllables(word: string) {
  const matches = word.toLowerCase().replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, matches?.length ?? 1);
}

function density(text: string, terms: string[]) {
  const wordCount = Math.max(1, tokenize(text).length);
  const lowered = text.toLowerCase();
  const hits = terms.reduce((sum, term) => sum + countOccurrences(lowered, term), 0);
  return (hits / wordCount) * 100;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sd(values: number[], average: number) {
  if (values.length < 2) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
