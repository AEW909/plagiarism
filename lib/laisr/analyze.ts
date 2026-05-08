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
  const linguisticProfile = buildLinguisticProfile(input.doc);
  const findings = [
    ...analyseMetadata(input.doc),
    ...analyseXml(input.doc),
    ...analyseTextual(input.doc),
    ...analyseStylometric(input.doc),
    ...analyseLinguistic(linguisticProfile)
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
    linguisticProfile,
    aiReview: input.aiReview,
    extractedTextPreview: input.doc.text.slice(0, 1400)
  };
}

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
    id: "relationships",
    label: "Relationships and embedded objects",
    category: "Relationships and Embedded Objects",
    clearDetail:
      "Checked relationship files, external targets, hyperlinks, embedded packages/objects, media references, and custom XML relationships."
  },
  {
    id: "ai",
    label: "AI plagiarism/authorship opinion",
    category: "AI Evidence Opinion",
    clearDetail:
      "Checked whether the optional AI evidence layer completed a direct plagiarism/authorship opinion before the later interpretation and judgement stages."
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
            ? "AI evidence opinion completed"
            : aiReview.status === "failed"
              ? "AI review failed"
              : aiReview.status === "pending"
                ? "AI review in progress"
              : "AI review not configured",
        detail:
          aiReview.status === "completed"
            ? "The AI evidence layer reviewed the text directly for plagiarism, AI-assistance, patchwriting, or authorship-inconsistency indicators. Interpretation, counter-argument, and final weighing are handled in later report stages."
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

  const words = parseInt(metadata.wordCount, 10);
  const editMinutes = parseInt(metadata.totalTimeMinutes, 10);
  if (Number.isFinite(words) && words >= 2500 && Number.isFinite(editMinutes) && editMinutes <= 5) {
    findings.push(makeFinding("metadata-low-edit-time", "Document Metadata", "notable", "Very low recorded editing time", `The extended properties report ${editMinutes} minutes of total editing time for ${words} words.`, "Expected: TotalTime is application-maintained and imperfect, but long essays with near-zero editing time are a supporting yellow flag when paired with other signals.", "docProps/app.xml", "Low recorded editing time can suggest late-stage assembly, copying into a fresh document, or metadata reset.", "Autosave behaviour, editor differences, copying from legitimate drafts, or app export workflows can make this field unreliable.", "Ask whether the candidate can show drafting history or earlier versions outside this final DOCX."));
  }

  if (metadata.template !== "N/A" && !/normal\.dotm|normal/i.test(metadata.template)) {
    findings.push(makeFinding("metadata-template", "Document Metadata", "notable", "Specific template metadata detected", `The document template is recorded as "${metadata.template}".`, "Expected: many student essays use Normal.dotm or a known institutional template; a specific unfamiliar template can indicate borrowed or assembled document origin.", "docProps/app.xml", "Template metadata can point to an external workflow or document source.", "Schools, departments, and accessibility tools may provide legitimate templates.", "Ask the candidate what template or starting file they used."));
  }

  if (metadata.company !== "N/A" && metadata.company.trim()) {
    findings.push(makeFinding("metadata-company", "Document Metadata", "notable", "Company metadata present", `The extended properties include company metadata: "${metadata.company}".`, "Expected: student essays often have blank company metadata unless created from an organisational template.", "docProps/app.xml", "Company metadata can indicate an external organisation, template, or device profile.", "It can also be inherited from school-managed devices or institutional templates.", "Ask whether the file began from a school template, workplace template, or shared device."));
  }

  if (doc.customXml.trim()) {
    findings.push(makeFinding("metadata-custom-props", "Document Metadata", "notable", "Custom document properties present", "The DOCX includes docProps/custom.xml custom properties.", "Expected: plain essays often have no custom properties; custom properties can be normal in institutional templates but should be understood.", "docProps/custom.xml", "Custom properties may preserve document-management metadata, content-type IDs, or template workflow traces.", "Institutional templates and SharePoint/OneDrive workflows can add legitimate custom properties.", "Ask whether the candidate used an official template or managed document workflow."));
  }

  return findings;
}

function analyseXml(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [...analysePackage(doc), ...analyseRelationships(doc)];
  const paragraphs = doc.documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const rsids = [...doc.documentXml.matchAll(/w:rsidR="([^"]+)"/g)].map((match) => match[1]);
  const uniqueRsids = new Set(rsids);
  const wordCount = tokenize(doc.text).length;

  if ((wordCount < 8000 && uniqueRsids.size > 80) || uniqueRsids.size > 150) {
    findings.push(makeFinding("xml-rsid", "XML Forensics", "notable", "Unusually varied edit-session identifiers", `The DOCX XML contains ${uniqueRsids.size} unique rsidR values across ${paragraphs.length || 1} paragraphs.`, "Expected: no fixed universal norm; this check flags >80 unique RSIDs under 8,000 words, and >150 unique RSIDs unconditionally.", "word/document.xml", "High RSID variety can be consistent with content assembled across multiple edit sessions or sources.", "Normal Word autosave, collaborative editing, and long editing histories can also increase RSID variety.", "Ask the candidate to explain how the document evolved and whether they can show drafts or version history."));
  }

  const rsidRoot = doc.settingsXml.match(/<w:rsidRoot[^>]*w:val="([^"]+)"/)?.[1];
  if (rsidRoot) {
    findings.push(makeFinding("xml-rsid-root", "XML Forensics", "info", "RSID root recorded", `The document settings contain rsidRoot "${rsidRoot}".`, "Expected: rsidRoot is most useful for comparison across suspiciously similar documents, where shared roots can indicate common origin.", "word/settings.xml", "This value can support future cross-document comparison if class-set review is added.", "Within a single document it is not a concern on its own.", "If other submissions are suspicious, compare their rsidRoot and distinctive RSID patterns."));
  }

  if (/<w:removePersonalInformation\b/.test(doc.settingsXml) || /<w:removeDateAndTime\b/.test(doc.settingsXml)) {
    findings.push(makeFinding("xml-privacy-scrub", "XML Forensics", "notable", "Personal information removal setting detected", "The settings part indicates personal information and/or annotation dates may be removed on save.", "Expected: these settings can legitimately protect privacy, but they mean missing author/date metadata should not be over-interpreted.", "word/settings.xml", "This can explain why comments/revisions lack author/date evidence or why metadata appears unusually clean.", "It may be enabled by institutional policy, Word privacy settings, or document inspection tools.", "Ask whether the candidate or school used Word's document inspector or privacy-cleaning settings."));
  }

  const altChunks = findPartMatches(doc.parts, /<w:altChunk\b[^>]*r:id="([^"]+)"/g);
  if (altChunks.length) {
    findings.push(makeFinding("xml-altchunk", "XML Forensics", "critical", "External content import marker detected", `${altChunks.length} w:altChunk import marker${altChunks.length === 1 ? "" : "s"} found in DOCX story parts.`, "Expected: altChunk explicitly marks mechanically imported external content and is uncommon in a straightforward student-authored essay.", "word/*.xml", "An unexplained altChunk is strong evidence that content was imported through a DOCX/HTML/RTF/text mechanism.", "There may be legitimate workflows, such as combining drafts or converting from another format.", "Ask what was imported, from where, and whether the candidate can show the original draft/source."));
  }

  const revisionAuthors = extractAttributeValues(doc.parts, /<w:(?:ins|del)\b[^>]*w:author="([^"]+)"/g);
  if (revisionAuthors.length) {
    findings.push(makeFinding("xml-revision-authors", "XML Forensics", "critical", "Tracked revision authors preserved", `Tracked insertions/deletions preserve author value(s): ${Array.from(new Set(revisionAuthors)).slice(0, 6).join(", ")}.`, "Expected: accepted final submissions usually do not preserve unexplained third-party revision authors.", "word/*.xml", "Preserved revision authors are strong evidence of another editing identity in the document history.", "Collaborative feedback, teacher comments, or supervised drafting can be legitimate if disclosed.", "Ask the candidate to explain who made the revisions and what role they played."));
  }

  const commentAuthors = extractAttributeValues(doc.parts, /<w:comment\b[^>]*w:author="([^"]+)"/g);
  if (commentAuthors.length) {
    findings.push(makeFinding("xml-comment-authors", "XML Forensics", "critical", "Comment authors preserved", `Comment metadata preserves author value(s): ${Array.from(new Set(commentAuthors)).slice(0, 6).join(", ")}.`, "Expected: final student submissions commonly have comments removed unless feedback/review remains intentionally.", "word/comments.xml", "Preserved comment authors can identify external reviewers, tutors, collaborators, or prior document owners.", "Teacher feedback or peer review can be legitimate if part of the allowed process.", "Ask the candidate to explain the comments and who authored them."));
  }

  const languageValues = extractAttributeValues(doc.parts, /<w:lang\b[^>]*w:val="([^"]+)"/g);
  if (new Set(languageValues).size > 3) {
    findings.push(makeFinding("xml-language-shifts", "XML Forensics", "notable", "Multiple document language settings", `Detected ${new Set(languageValues).size} distinct w:lang values: ${Array.from(new Set(languageValues)).slice(0, 8).join(", ")}.`, "Expected: multilingual references are normal, but many abrupt locale clusters can support a copied/assembled-source hypothesis.", "word/*.xml", "Language/locale shifts can indicate pasted content from different sources or spell-check environments.", "Normal quotes, references, foreign-language terms, or school templates can create language variation.", "Ask about drafting environment and any copied quoted material."));
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

  const runCount = (doc.documentXml.match(/<w:r\b/g) ?? []).length;
  const visibleWords = Math.max(1, tokenize(doc.text).length);
  const runDensity = runCount / visibleWords;
  if (visibleWords > 300 && runDensity > 2.2) {
    findings.push(makeFinding("xml-run-density", "XML Forensics", "notable", "High XML run density", `The document has ${runCount} text runs for about ${visibleWords} words (${runDensity.toFixed(1)} runs per word).`, "Expected: simple prose usually has far fewer runs than words; extreme run density can follow web/PDF paste and cleanup.", "word/document.xml", "High run density can be consistent with pasted formatted content, hyperlink cleanup, or automated conversion.", "Frequent styling, comments, citations, or accessibility tools can increase run counts.", "Ask whether content was pasted from formatted notes, web pages, PDFs, or another editor."));
  }

  const styleIds = new Set(extractAttributeValues({ "word/document.xml": doc.documentXml }, /w:pStyle[^>]*w:val="([^"]+)"/g));
  const styleDefinitions = (doc.parts["word/styles.xml"]?.match(/<w:style\b/g) ?? []).length;
  if (styleDefinitions > 80 || styleIds.size > 12) {
    findings.push(makeFinding("xml-style-complexity", "XML Forensics", "notable", "Large or complex style inventory", `The styles part defines ${styleDefinitions} styles and the body uses ${styleIds.size} paragraph style IDs.`, "Expected: simple essays usually use a small visible subset of styles; large custom inventories can indicate imported templates or merged documents.", "word/styles.xml", "Excessive style definitions can support an external template or document assembly hypothesis.", "Institutional templates can legitimately carry large style sets.", "Ask what template or source document was used as the starting point."));
  }

  const numberingDefs = (doc.parts["word/numbering.xml"]?.match(/<w:abstractNum\b/g) ?? []).length;
  if (numberingDefs > 12) {
    findings.push(makeFinding("xml-numbering-complexity", "XML Forensics", "notable", "Complex numbering definitions", `The numbering part defines ${numberingDefs} abstract numbering structures.`, "Expected: essays with few lists usually have little numbering complexity; imported fragments can drag unused numbering definitions.", "word/numbering.xml", "Complex numbering can support a merged/imported-document hypothesis.", "Templates and reference managers can also add numbering structures.", "Ask whether material was combined from another document or template."));
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

function analysePackage(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const relevant = doc.zipEntries.filter((entry) =>
    /^(docProps\/|word\/(?:document|styles|numbering|settings|footnotes|endnotes|header|footer)|word\/_rels\/document\.xml\.rels)/.test(entry.name)
  );
  const timestamps = relevant
    .map((entry) => Date.parse(entry.date))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length >= 6) {
    const spreadSeconds = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000;
    if (spreadSeconds <= 5) {
      findings.push(makeFinding("package-uniform-timestamps", "Package Forensics", "notable", "Compressed package timestamps", `${timestamps.length} high-value DOCX package parts have timestamps within ${spreadSeconds.toFixed(0)} seconds.`, "Expected: ZIP member timestamps can be rewritten by resave/export, but highly compressed timestamps are a packaging clue when paired with low edit time or revision anomalies.", "DOCX ZIP central directory", "Uniform timestamps can suggest late-stage repackaging, export, conversion, or copying into a newly saved file.", "Normal Word resaves, cloud exports, or document conversion can also rewrite many package timestamps together.", "Ask whether the file was exported, converted, or copied into a fresh document before submission."));
    }
  }

  return findings;
}

function analyseRelationships(doc: ExtractedDocx): Finding[] {
  const findings: Finding[] = [];
  const relParts = Object.entries(doc.parts).filter(([name]) => name.endsWith(".rels"));
  const relationshipXml = relParts.map(([name, xml]) => `${name}\n${xml}`).join("\n");
  const externalTargets = [...relationshipXml.matchAll(/<Relationship\b[^>]*TargetMode="External"[^>]*Target="([^"]+)"/g)].map((match) => match[1]);
  const altChunkRels = [...relationshipXml.matchAll(/<Relationship\b[^>]*Type="[^"]*\/aFChunk"[^>]*Target="([^"]+)"/g)].map((match) => match[1]);
  const embeddedParts = doc.zipEntries.filter((entry) => /^word\/embeddings\//.test(entry.name));
  const customXmlParts = doc.zipEntries.filter((entry) => /^customXml\//.test(entry.name) && entry.name.endsWith(".xml"));
  const docPrValues = [...Object.values(doc.parts).join("\n").matchAll(/<wp:docPr\b[^>]*(?:descr|title|name)="([^"]+)"/g)].map((match) => match[1]);

  if (externalTargets.length) {
    findings.push(makeFinding("rels-external-targets", "Relationships and Embedded Objects", "notable", "External relationship targets detected", `The package contains ${externalTargets.length} external relationship target${externalTargets.length === 1 ? "" : "s"}, including ${externalTargets.slice(0, 5).join(", ")}.`, "Expected: hyperlinks are common in references, but external relationships are important routing evidence and should be reviewed.", "*.rels", "External relationships can reveal source URLs, linked resources, or dependencies not obvious in visible text.", "References, citations, and legitimate hyperlinks can explain external targets.", "Ask whether external links are cited sources, pasted web residue, or linked resources."));
  }

  if (altChunkRels.length) {
    findings.push(makeFinding("rels-altchunk-targets", "Relationships and Embedded Objects", "critical", "altChunk import relationship detected", `Relationship files point to altChunk import target(s): ${altChunkRels.slice(0, 5).join(", ")}.`, "Expected: altChunk relationships directly identify mechanically imported content parts and are uncommon in normal essay drafting.", "word/_rels/*.rels", "This is strong structural evidence of external content import.", "A legitimate conversion or draft-combining workflow can create this, but it should be explainable.", "Ask the candidate what was imported and whether they can show the source draft."));
  }

  if (embeddedParts.length) {
    findings.push(makeFinding("rels-embedded-objects", "Relationships and Embedded Objects", "critical", "Embedded object/package present", `The DOCX contains ${embeddedParts.length} embedded object/package part${embeddedParts.length === 1 ? "" : "s"}: ${embeddedParts.slice(0, 5).map((entry) => entry.name).join(", ")}.`, "Expected: simple essays rarely need embedded packages; embedded content can carry its own metadata and hidden provenance.", "word/embeddings/*", "Embedded objects may contain source material, spreadsheets, PDFs, or separate metadata requiring inspection.", "A legitimate appendix, chart, or object insert can explain embedded content.", "Ask what the embedded object is and why it is included."));
  }

  if (customXmlParts.length) {
    findings.push(makeFinding("rels-custom-xml", "Relationships and Embedded Objects", "notable", "Custom XML parts present", `The package contains ${customXmlParts.length} custom XML part${customXmlParts.length === 1 ? "" : "s"}.`, "Expected: institutional templates may include custom XML, but plain essays often do not.", "customXml/*", "Custom XML can indicate document-management metadata, data-bound placeholders, or templated generation.", "School templates, Word content controls, and SharePoint/OneDrive workflows can legitimately add custom XML.", "Ask whether the candidate used an official template or managed workflow."));
  }

  if (docPrValues.length) {
    const suspicious = docPrValues.filter((value) => /http|generated|image|screenshot|stock|ai|openai|chatgpt/i.test(value));
    if (suspicious.length) {
      findings.push(makeFinding("rels-image-alt-text", "Relationships and Embedded Objects", "notable", "Image metadata or alt text looks source-like", `Drawing metadata includes value(s): ${suspicious.slice(0, 5).join(", ")}.`, "Expected: image names/alt text should usually describe the image; source-like or generated labels can preserve provenance clues.", "word/document.xml drawing properties", "Image metadata can reveal copied web/source context or automated insertion.", "Alt text may be generated by accessibility tools or inherited from legitimate image sources.", "Ask the candidate to explain the image source and how it was inserted."));
    }
  }

  return findings;
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

function analyseLinguistic(profile: LaisrReport["linguisticProfile"]): Finding[] {
  const findings: Finding[] = [];

  profile.segments.forEach((metric) => {
    if (metric.complexityBand !== "normal") {
      const direction = metric.complexityBand === "high" ? "more complex" : "simpler";
      findings.push(makeFinding(`ling-grade-${metric.index}`, "Linguistic Consistency", "notable", `Complexity shift in segment ${metric.index + 1}`, `This section is ${direction} than the document's usual writing level. Estimated grade: ${metric.fkGrade.toFixed(1)}; document average: ${profile.meanFkGrade.toFixed(1)}. Opening: "${clip(metric.opening, 180)}".`, "Expected: sections normally vary, but large jumps above or below the document's own average are worth reviewing.", `Segment ${metric.index + 1}`, "A sudden change in complexity can mean a section came from a different draft, source, or writing process.", "Introductions, technical sections, and conclusions can naturally be simpler or more complex.", "Ask the candidate to explain this section in their own words and describe how it was drafted."));
    }

    if (metric.registerBand === "high") {
      findings.push(makeFinding(`ling-register-${metric.index}`, "Linguistic Consistency", "notable", `Formal register spike in segment ${metric.index + 1}`, `This section uses formal academic wording more densely than the rest of the document. Formal-word density: ${metric.formalDensity.toFixed(1)} per 100 words; document average: ${profile.meanFormalDensity.toFixed(1)}. Opening: "${clip(metric.opening, 180)}".`, "Expected: formal wording should usually rise and fall gradually with the topic; this check flags sections that stand out from the document's own pattern.", `Segment ${metric.index + 1}`, "A local spike can suggest pasted, heavily edited, or AI-assisted prose if it is not explained by the subject matter.", "A source-heavy or carefully revised paragraph may legitimately become more formal.", "Ask the candidate to explain the terms in this section and how the wording developed."));
    }
  });

  return findings.slice(0, 12);
}

function buildLinguisticProfile(doc: ExtractedDocx): LaisrReport["linguisticProfile"] {
  const segments = segmentText(doc.text, 150);
  const metrics = segments.map((segment) => ({
    text: segment,
    wordCount: tokenize(segment).length,
    fk: estimateGrade(segment),
    formalDensity: density(segment, FORMAL_ACADEMIC)
  }));
  const meanGrade = mean(metrics.map((metric) => metric.fk));
  const sdGrade = sd(metrics.map((metric) => metric.fk), meanGrade);
  const meanFormal = mean(metrics.map((metric) => metric.formalDensity));
  const sdFormal = sd(metrics.map((metric) => metric.formalDensity), meanFormal);

  return {
    meanFkGrade: meanGrade,
    meanFormalDensity: meanFormal,
    segments: metrics.map((metric, index) => ({
      index,
      wordCount: metric.wordCount,
      fkGrade: metric.fk,
      formalDensity: metric.formalDensity,
      complexityBand:
        sdGrade > 0 && metric.fk > meanGrade + sdGrade * 1.8
          ? "high"
          : sdGrade > 0 && metric.fk < meanGrade - sdGrade * 1.8
            ? "low"
            : "normal",
      registerBand:
        sdFormal > 0 && metric.formalDensity > meanFormal + sdFormal * 2 ? "high" : "normal",
      opening: clip(metric.text, 220)
    }))
  };
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

function findPartMatches(parts: Record<string, string>, pattern: RegExp) {
  const matches: Array<{ part: string; value: string }> = [];
  for (const [part, xml] of Object.entries(parts)) {
    if (!part.startsWith("word/") || !part.endsWith(".xml")) {
      continue;
    }
    for (const match of xml.matchAll(pattern)) {
      matches.push({ part, value: match[1] ?? match[0] });
    }
  }
  return matches;
}

function extractAttributeValues(parts: Record<string, string>, pattern: RegExp) {
  const values: string[] = [];
  for (const xml of Object.values(parts)) {
    for (const match of xml.matchAll(pattern)) {
      if (match[1]) {
        values.push(decodeXml(match[1]));
      }
    }
  }
  return values;
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
