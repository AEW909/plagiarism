import type { ExtractedDocx } from "./docx";
import { buildEvidenceChecks } from "./evidence-checks";
import {
  buildAssessment,
  buildCounterArgument,
  buildInterpretation,
  buildVivaQuestions,
  getRecommendation,
  shouldRecommendViva
} from "./recommendation";
import type { Finding, FindingAnchor, LaisrReport } from "./types";

type ReportInput = {
  doc: ExtractedDocx;
  authenticatedDoc?: ExtractedDocx | null;
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
  "that said",
  "by contrast",
  "on the contrary",
  "yet",
  "furthermore",
  "moreover",
  "in addition",
  "additionally",
  "equally",
  "in the same vein",
  "also",
  "besides",
  "therefore",
  "consequently",
  "thus",
  "hence",
  "as a result",
  "accordingly",
  "it follows that",
  "this suggests that",
  "for this reason",
  "although",
  "despite",
  "notwithstanding",
  "even though",
  "while it is true",
  "importantly",
  "notably",
  "significantly",
  "crucially",
  "it is worth noting",
  "it should be noted",
  "in conclusion",
  "in summary",
  "overall",
  "taken together",
  "to summarise"
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
  "whilst",
  "utilization",
  "inasmuch",
  "insofar",
  "whereby",
  "wherein",
  "therein",
  "underpins",
  "underpin"
];

const INFORMAL_COLLOQUIAL = [
  "basically",
  "kind of",
  "sort of",
  "pretty much",
  "a lot of",
  "loads of",
  "stuff",
  "things",
  "really",
  "very very",
  "super",
  "totally",
  "get",
  "got",
  "big",
  "way too",
  "so much",
  "big deal",
  "a bit",
  "quite a",
  "you know",
  "i mean",
  "like really",
  "honestly"
];

const KNOWN_MERGED_COMPOUNDS = [
  "laboratorybased",
  "highquality",
  "lowerlevel",
  "higherlevel",
  "largescale",
  "smallscale",
  "longtail",
  "shortterm",
  "longterm",
  "wellknown",
  "evidencebased",
  "schoolbased",
  "homebased",
  "workbased",
  "internetbased",
  "computerbased",
  "populationbased",
  "communitybased",
  "riskbased",
  "timeconsuming",
  "lifelong",
  "worldwide",
  "healthcare",
  "wellbeing",
  "wellestablished",
  "wideranging",
  "farreaching",
  "hardwired",
  "deeprooted",
  "longstanding",
  "widescale"
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
  "writing",
  "well",
  "known",
  "small",
  "higher",
  "evidence",
  "school",
  "home",
  "internet",
  "computer",
  "population",
  "community",
  "risk",
  "time",
  "consuming",
  "life",
  "world",
  "wide",
  "health",
  "care",
  "being",
  "established",
  "range",
  "ranging",
  "far",
  "reaching",
  "hard",
  "wired",
  "deep",
  "rooted",
  "standing"
]);

export function buildReport(input: ReportInput): LaisrReport {
  const linguisticProfile = buildLinguisticProfile(input.doc);
  const comparativeProfile = buildComparativeProfile(input.doc, input.authenticatedDoc ?? null);
  const findings = [
    ...analyseMetadata(input.doc),
    ...analyseXml(input.doc),
    ...analyseTextual(input.doc),
    ...analyseStylometric(input.doc),
    ...analyseLinguistic(linguisticProfile),
    ...analyseComparative(comparativeProfile)
  ];
  const seriousCount = findings.filter((finding) => finding.severity === "critical" || finding.severity === "serious").length;
  const notableCount = findings.filter((finding) => finding.severity === "notable").length;
  const recommendation = getRecommendation(seriousCount, notableCount);
  const vivaQuestions = shouldRecommendViva(recommendation)
    ? buildVivaQuestions(findings, input.subject)
    : [];
  const evidenceChecks = buildEvidenceChecks(findings, input.aiReview, comparativeProfile);

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
    comparativeProfile,
    aiReview: input.aiReview,
    extractedTextPreview: input.doc.text,
    authenticatedTextPreview: input.authenticatedDoc?.text
  };
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

  if (wordCount >= 1200 && uniqueRsids.size > 0 && uniqueRsids.size <= 3) {
    findings.push(makeFinding("xml-low-rsid-diversity", "XML Forensics", "notable", "Very low edit-session diversity", `The document contains about ${wordCount} words but only ${uniqueRsids.size} unique rsidR edit-session value${uniqueRsids.size === 1 ? "" : "s"}.`, "Expected: longer essays often show a varied pattern of edit-session IDs as text is drafted, saved, revised, and reorganised. Very low diversity can happen when text is pasted into a fresh document or passed through a plain-text workflow.", "word/document.xml", "This can support a washed-text or single-block assembly hypothesis when paired with low editing time, uniform timestamps, or weak drafting evidence.", "A student could genuinely draft in one sitting, use an editor that rewrites RSIDs, or paste from their own legitimate notes into a clean final file.", "Ask whether the candidate drafted elsewhere first, used a plain-text editor, or copied from earlier notes into the final document."));
  }

  const paragraphRsidProfile = paragraphs.map((paragraphXml, index) => {
    const text = extractTextFromXml(paragraphXml);
    const paragraphRsids = [...paragraphXml.matchAll(/w:rsidR="([^"]+)"/g)].map((match) => match[1]);
    const uniqueParagraphRsids = [...new Set(paragraphRsids)];

    return {
      index,
      text,
      wordCount: tokenize(text).length,
      primaryRsid: uniqueParagraphRsids.length === 1 ? uniqueParagraphRsids[0] : null,
      rsidCount: uniqueParagraphRsids.length
    };
  });

  const bulkRuns: Array<{ rsid: string; start: number; end: number; words: number; sample: string }> = [];
  let currentRun: { rsid: string; start: number; end: number; words: number; sample: string } | null = null;

  for (const paragraph of paragraphRsidProfile) {
    if (!paragraph.primaryRsid || paragraph.wordCount < 25) {
      if (currentRun) {
        bulkRuns.push(currentRun);
        currentRun = null;
      }
      continue;
    }

    if (currentRun !== null && currentRun.rsid === paragraph.primaryRsid) {
      currentRun.end = paragraph.index;
      currentRun.words += paragraph.wordCount;
    } else {
      if (currentRun) {
        bulkRuns.push(currentRun);
      }
      currentRun = {
        rsid: paragraph.primaryRsid,
        start: paragraph.index,
        end: paragraph.index,
        words: paragraph.wordCount,
        sample: paragraph.text
      };
    }
  }

  if (currentRun) {
    bulkRuns.push(currentRun);
  }

  const bulkPasteCandidates = bulkRuns.filter((run) => run.end > run.start && run.words >= 300);
  if (bulkPasteCandidates.length > 0) {
    const examples = bulkPasteCandidates
      .slice(0, 3)
      .map((run) => `paragraphs ${run.start + 1}-${run.end + 1}, about ${run.words} words, RSID ${run.rsid}: "${clip(run.sample, 90)}"`)
      .join("; ");

    findings.push(makeFinding("xml-bulk-rsid-block", "XML Forensics", "notable", "Large block shares one edit-session ID", `${bulkPasteCandidates.length} multi-paragraph block${bulkPasteCandidates.length === 1 ? "" : "s"} share a single edit-session ID across at least 300 words. Examples: ${examples}.`, "Expected: naturally drafted essays often show edit-session IDs mixed across sections as text is typed, revised, and saved. Large consecutive blocks with one ID can be a clue that text arrived all at once.", "word/document.xml", "This can support a bulk-paste or document-assembly hypothesis, especially if the block also differs in style, language, or formatting.", "A legitimate paste from the student's own draft, notes, or another word processor can create the same pattern.", "Ask the candidate to explain how that section was drafted and whether it was copied from another file, note set, or editor."));
  }

  const rsidRoot = doc.settingsXml.match(/<w:rsidRoot[^>]*w:val="([^"]+)"/)?.[1];
  if (rsidRoot) {
    findings.push(makeFinding("xml-rsid-root", "XML Forensics", "info", "RSID root recorded", `The document settings contain rsidRoot "${rsidRoot}".`, "Expected: rsidRoot is most useful for comparison across suspiciously similar documents, where shared roots can indicate common origin.", "word/settings.xml", "This value can support future cross-document comparison if class-set review is added.", "Within a single document it is not a concern on its own.", "If other submissions are suspicious, compare their rsidRoot and distinctive RSID patterns."));
  }

  const settingsRsids = new Set(
    [...doc.settingsXml.matchAll(/<w:rsid\b[^>]*w:val="([^"]+)"/g)].map((match) => match[1])
  );
  const missingRsidParagraphs = paragraphs
    .map((paragraphXml, index) => {
      const paragraphRsids = [
        ...new Set([...paragraphXml.matchAll(/w:rsid[A-Za-z0-9]*="([^"]+)"/g)].map((match) => match[1]))
      ];
      const missing = paragraphRsids.filter((rsid) => !settingsRsids.has(rsid));
      return missing.length
        ? {
            index,
            missing,
            text: extractTextFromXml(paragraphXml)
          }
        : null;
    })
    .filter((item): item is { index: number; missing: string[]; text: string } => Boolean(item));

  if (settingsRsids.size > 0 && missingRsidParagraphs.length > 0) {
    const missingValues = [
      ...new Set(missingRsidParagraphs.flatMap((paragraph) => paragraph.missing))
    ];
    const examples = missingRsidParagraphs
      .slice(0, 3)
      .map((paragraph) => `paragraph ${paragraph.index + 1}: "${clip(paragraph.text, 90)}"`)
      .join("; ");

    findings.push(makeFinding("xml-rsid-missing-from-settings", "XML Forensics", "notable", "Text uses edit IDs missing from the document's session table", `${missingRsidParagraphs.length} paragraph${missingRsidParagraphs.length === 1 ? "" : "s"} contain edit-session IDs that appear in the document body but not in Word's overall RSID table. Missing value examples: ${missingValues.slice(0, 8).join(", ")}. Text examples: ${examples}.`, "Expected: when text is written and edited normally in the same Word document, its edit-session IDs usually appear in the document's settings table. IDs missing from that table can be a clue that the text was pasted or imported from somewhere else.", "word/document.xml compared with word/settings.xml", "This can support a copy-paste or document-assembly hypothesis, especially if the affected paragraphs also have formatting, language, or style changes.", "Some legitimate conversions, template workflows, recovery saves, or editor differences can also create RSID mismatches.", "Ask the candidate to explain the affected paragraph and whether it was pasted from notes, another draft, a web editor, or a converted file."));
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

  const browserResidues = findBrowserResidues(doc.parts);
  if (browserResidues.length) {
    const examples = browserResidues
      .slice(0, 5)
      .map((hit) => `${hit.value} in ${hit.part}`)
      .join("; ");
    findings.push(makeFinding("xml-browser-residue-wide", "XML Forensics", "critical", "Browser-origin formatting residue detected", `Found browser/CSS formatting residue in the DOCX XML, including ${examples}.`, "Expected: a normal Word-authored essay should not usually contain CSS/browser font names such as -webkit-standard, -apple-system, BlinkMacSystemFont, or similar web-rendering markers.", "DOCX XML parts", "These markers can indicate that content or styling came through a browser-based editor, web page, AI chat interface, or HTML conversion before reaching Word.", "Google Docs, Word Online, learning platforms, accessibility tools, or legitimate copied notes can also leave browser-style residue.", "Ask the candidate whether any section was copied from a web page, browser editor, AI chat window, or online document editor."));
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

  const grammarPatterns: Array<{ id: string; pattern: RegExp; title: string; explanation: string }> = [
    {
      id: "despite-of",
      pattern: /\bdespite of\b/i,
      title: "Non-standard phrase: despite of",
      explanation: "The phrase \"despite of\" is non-standard in formal English."
    },
    {
      id: "modal-of",
      pattern: /\b(?:could|would|should) of\b/i,
      title: "Non-standard modal phrase",
      explanation: "The document contains a phrase such as \"could of\", \"would of\", or \"should of\"."
    },
    {
      id: "may-possibly",
      pattern: /\bmay possibly\b/i,
      title: "Redundant modal phrase",
      explanation: "The phrase \"may possibly\" appears, which can be a filler-like or over-paraphrased construction."
    },
    {
      id: "very-unique",
      pattern: /\bvery unique\b/i,
      title: "Non-standard intensifier",
      explanation: "The phrase \"very unique\" appears, which can signal awkward automated or over-edited prose."
    }
  ];

  for (const grammar of grammarPatterns) {
    const match = doc.text.match(grammar.pattern);
    if (match) {
      const index = match.index ?? 0;
      findings.push(makeFinding(`text-grammar-${grammar.id}`, "Textual Anomalies", "notable", grammar.title, `${grammar.explanation} Surrounding sentence: "${clip(sentenceAround(doc.text, index), 220)}".`, "Text body", "Small grammar artefacts matter most when they sit inside otherwise polished prose or cluster with other evidence.", "A candidate can make ordinary grammar mistakes, especially when editing quickly.", "Ask the candidate to explain the sentence and how it changed during editing."));
    }
  }

  for (const known of KNOWN_MERGED_COMPOUNDS) {
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

  if (profile.consistencyScore < 65) {
    findings.push(makeFinding("ling-consistency-score", "Linguistic Consistency", profile.consistencyScore < 40 ? "serious" : "notable", "Low writing consistency score", `The document-level consistency score is ${profile.consistencyScore}/100 (${profile.consistencyLabel}). This score combines unusual complexity shifts, formal-register spikes, and passive-voice spikes across document sections.`, "Expected: 85-100 consistent; 65-84 minor inconsistencies; 40-64 moderate inconsistencies; 0-39 severe inconsistencies.", "Whole document", "A low score means several sections differ from the document's own baseline and deserve examiner attention.", "A long essay can naturally vary between narrative, technical, and evaluative sections.", "Ask the candidate which sections were hardest to write and how the style changed between drafts."));
  }

  profile.segments.forEach((metric) => {
    if (metric.complexityBand !== "normal") {
      const direction = metric.complexityBand === "high" ? "more complex" : "simpler";
      findings.push(makeFinding(`ling-grade-${metric.index}`, "Linguistic Consistency", "notable", `Complexity shift in segment ${metric.index + 1}`, `This section is ${direction} than the document's usual writing level. Estimated grade: ${metric.fkGrade.toFixed(1)}; document average: ${profile.meanFkGrade.toFixed(1)}. Opening: "${clip(metric.opening, 180)}".`, "Expected: sections normally vary, but large jumps above or below the document's own average are worth reviewing.", `Segment ${metric.index + 1}`, "A sudden change in complexity can mean a section came from a different draft, source, or writing process.", "Introductions, technical sections, and conclusions can naturally be simpler or more complex.", "Ask the candidate to explain this section in their own words and describe how it was drafted."));
    }

    if (metric.registerBand === "high") {
      findings.push(makeFinding(`ling-register-${metric.index}`, "Linguistic Consistency", "notable", `Formal register spike in segment ${metric.index + 1}`, `This section uses formal academic wording more densely than the rest of the document. Formal-word density: ${metric.formalDensity.toFixed(1)} per 100 words; document average: ${profile.meanFormalDensity.toFixed(1)}. Opening: "${clip(metric.opening, 180)}".`, "Expected: formal wording should usually rise and fall gradually with the topic; this check flags sections that stand out from the document's own pattern.", `Segment ${metric.index + 1}`, "A local spike can suggest pasted, heavily edited, or AI-assisted prose if it is not explained by the subject matter.", "A source-heavy or carefully revised paragraph may legitimately become more formal.", "Ask the candidate to explain the terms in this section and how the wording developed."));
    }

    if (metric.passiveBand === "high") {
      findings.push(makeFinding(`ling-passive-${metric.index}`, "Linguistic Consistency", "notable", `Passive-voice spike in segment ${metric.index + 1}`, `This section uses passive constructions more heavily than the rest of the document. Passive density: ${metric.passiveDensity.toFixed(1)} per sentence; document average: ${profile.meanPassiveDensity.toFixed(1)}. Opening: "${clip(metric.opening, 180)}".`, "Expected: passive voice can be normal in academic writing, but a sudden local spike can mark a different drafting source or register.", `Segment ${metric.index + 1}`, "A passive-voice spike can suggest imported academic prose or heavy rewriting if it appears suddenly.", "Scientific method sections and source summaries often use passive voice legitimately.", "Ask the candidate to rewrite the key claim actively and explain why the passive wording was used."));
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
    fog: estimateFog(segment),
    ttr: typeTokenRatio(segment),
    formalDensity: density(segment, FORMAL_ACADEMIC),
    passiveDensity: passiveDensity(segment)
  }));
  const meanGrade = mean(metrics.map((metric) => metric.fk));
  const sdGrade = sd(metrics.map((metric) => metric.fk), meanGrade);
  const meanFog = mean(metrics.map((metric) => metric.fog));
  const meanFormal = mean(metrics.map((metric) => metric.formalDensity));
  const sdFormal = sd(metrics.map((metric) => metric.formalDensity), meanFormal);
  const meanPassive = mean(metrics.map((metric) => metric.passiveDensity));
  const sdPassive = sd(metrics.map((metric) => metric.passiveDensity), meanPassive);
  const flags = metrics.reduce((sum, metric) => {
    const complexityFlag = sdGrade > 0 && Math.abs(metric.fk - meanGrade) > sdGrade * 1.8;
    const registerFlag = sdFormal > 0 && metric.formalDensity > meanFormal + sdFormal * 2;
    const passiveFlag = sdPassive > 0 && metric.passiveDensity > meanPassive + sdPassive * 2;
    return sum + (complexityFlag ? 5 : 0) + (registerFlag ? 8 : 0) + (passiveFlag ? 6 : 0);
  }, 0);
  const consistencyScore = Math.max(0, 100 - flags);

  return {
    meanFkGrade: meanGrade,
    meanFogIndex: meanFog,
    meanFormalDensity: meanFormal,
    meanPassiveDensity: meanPassive,
    consistencyScore,
    consistencyLabel: consistencyLabel(consistencyScore),
    segments: metrics.map((metric, index) => ({
      index,
      wordCount: metric.wordCount,
      fkGrade: metric.fk,
      fogIndex: metric.fog,
      typeTokenRatio: metric.ttr,
      formalDensity: metric.formalDensity,
      passiveDensity: metric.passiveDensity,
      complexityBand:
        sdGrade > 0 && metric.fk > meanGrade + sdGrade * 1.8
          ? "high"
          : sdGrade > 0 && metric.fk < meanGrade - sdGrade * 1.8
            ? "low"
            : "normal",
      registerBand:
        sdFormal > 0 && metric.formalDensity > meanFormal + sdFormal * 2 ? "high" : "normal",
      passiveBand:
        sdPassive > 0 && metric.passiveDensity > meanPassive + sdPassive * 2 ? "high" : "normal",
      opening: clip(metric.text, 220)
    }))
  };
}

function buildComparativeProfile(doc: ExtractedDocx, authenticatedDoc: ExtractedDocx | null): LaisrReport["comparativeProfile"] {
  if (!authenticatedDoc) {
    return {
      available: false,
      score: 0,
      label: "No authenticated sample supplied",
      metrics: [],
      summary:
        "No authenticated writing sample was supplied, so LAISR could not compare this submission against known writing by the same candidate."
    };
  }

  const submitted = writingSignature(doc.text);
  const authenticated = writingSignature(authenticatedDoc.text);
  const metrics = [
    compareMetric("FK grade", submitted.fkGrade, authenticated.fkGrade, 2, 4),
    compareMetric("Fog index", submitted.fogIndex, authenticated.fogIndex, 2.5, 5),
    compareMetric("Average sentence length", submitted.avgSentenceLength, authenticated.avgSentenceLength, 4, 8),
    compareMetric("Average word length", submitted.avgWordLength, authenticated.avgWordLength, 0.35, 0.7),
    compareMetric("Type-token ratio", submitted.typeTokenRatio, authenticated.typeTokenRatio, 0.08, 0.15),
    compareMetric("Formal wording density", submitted.formalDensity, authenticated.formalDensity, 2.5, 5),
    compareMetric("Informal wording density", submitted.informalDensity, authenticated.informalDensity, 2, 4),
    compareMetric("Transition density", submitted.transitionDensity, authenticated.transitionDensity, 4, 8),
    compareMetric("Sentence opener pattern", submitted.openerPercent, authenticated.openerPercent, 8, 16)
  ];
  const penalty = metrics.reduce((sum, metric) => sum + (metric.severity === "critical" ? 16 : metric.severity === "notable" ? 8 : 0), 0);
  const score = Math.max(0, 100 - penalty);
  const label =
    score >= 80
      ? "Stylistically consistent with supplied sample"
      : score >= 60
        ? "Moderate divergence from supplied sample"
        : "Significant divergence from supplied sample";

  return {
    available: true,
    sampleFileName: authenticatedDoc.fileName,
    score,
    label,
    metrics,
    summary: `Compared with "${authenticatedDoc.fileName}", the submitted document scored ${score}/100 for stylistic similarity. ${metrics.filter((metric) => metric.severity !== "clear").length} metric${metrics.filter((metric) => metric.severity !== "clear").length === 1 ? "" : "s"} showed notable or critical divergence.`
  };
}

function analyseComparative(profile: LaisrReport["comparativeProfile"]): Finding[] {
  if (!profile.available) {
    return [];
  }

  const findings: Finding[] = [];
  const divergent = profile.metrics.filter((metric) => metric.severity !== "clear");

  if (profile.score < 80 || divergent.length > 0) {
    findings.push(makeFinding("compare-overall", "Authenticated Writing Comparison", profile.score < 60 ? "serious" : "notable", "Submitted style differs from authenticated sample", `${profile.summary} Largest differences: ${divergent.slice(0, 4).map((metric) => `${metric.label} difference ${metric.difference.toFixed(2)}`).join("; ") || "none above threshold"}.`, "Expected: a score of 80-100 suggests broad consistency; 60-79 suggests moderate divergence; below 60 suggests significant divergence needing context.", "Submitted document vs authenticated sample", "A style mismatch is one of the strongest fair-use signals because it compares the candidate with their own known writing rather than with a generic norm.", "Writing style can legitimately change by topic, time pressure, drafting help, genre, or improvement over time.", "Ask the candidate to compare this essay with their earlier sample and explain any differences in style, vocabulary, and structure."));
  }

  for (const metric of divergent.slice(0, 6)) {
    findings.push(makeFinding(`compare-${slug(metric.label)}`, "Authenticated Writing Comparison", metric.severity === "critical" ? "serious" : "notable", `${metric.label} differs from authenticated sample`, `Submitted value: ${metric.submitted.toFixed(2)}. Authenticated sample: ${metric.authenticated.toFixed(2)}. Difference: ${metric.difference.toFixed(2)}.`, "Expected: this comparison uses conservative thresholds from the prototype: notable divergence at the lower threshold and serious divergence at the higher threshold.", "Submitted document vs authenticated sample", "A single metric is not decisive, but clusters of differences can indicate a different writing process, source, or level of assistance.", "The candidate may have written in a different genre, received normal teaching feedback, or developed between samples.", `Ask why the ${metric.label.toLowerCase()} differs from the earlier writing sample and invite the candidate to explain their drafting choices.`));
  }

  return findings;
}

function makeFinding(id: string, category: string, severity: Finding["severity"], title: string, evidence: string, normalRangeOrLocation: string, locationOrInterpretation: string, interpretationOrCounterArgument: string, counterArgumentOrVivaAngle: string, vivaAngle?: string): Finding {
  if (vivaAngle === undefined) {
    const location = normalRangeOrLocation;
    return {
      id,
      category,
      severity,
      title,
      evidence,
      location,
      interpretation: locationOrInterpretation,
      counterArgument: interpretationOrCounterArgument,
      vivaAngle: counterArgumentOrVivaAngle,
      anchors: inferFindingAnchors(location, evidence),
      facts: inferFindingFacts(evidence)
    };
  }

  const location = locationOrInterpretation;
  return {
    id,
    category,
    severity,
    title,
    evidence,
    normalRange: normalRangeOrLocation,
    location,
    interpretation: interpretationOrCounterArgument,
    counterArgument: counterArgumentOrVivaAngle,
    vivaAngle,
    anchors: inferFindingAnchors(location, evidence),
    facts: inferFindingFacts(evidence)
  };
}

function inferFindingFacts(evidence: string) {
  const quotedValues = [...evidence.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const numbers = [...evidence.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((match) => Number(match[0]));

  if (quotedValues.length === 0 && numbers.length === 0) {
    return undefined;
  }

  return {
    ...(quotedValues.length ? { quotedValues } : {}),
    ...(numbers.length ? { numbers } : {})
  };
}

function inferFindingAnchors(location: string | undefined, evidence: string): FindingAnchor[] | undefined {
  const text = `${location || ""} ${evidence}`;
  const paragraphRange = text.match(/paragraphs?\s+(\d+)(?:[-\u2013](\d+))?/i);
  if (paragraphRange) {
    const start = Number(paragraphRange[1]);
    const end = Number(paragraphRange[2] || paragraphRange[1]);
    return [{
      type: "paragraph",
      start: Math.min(start, end),
      end: Math.max(start, end),
      label: start === end ? `Paragraph ${start}` : `Paragraphs ${Math.min(start, end)}-${Math.max(start, end)}`
    }];
  }

  const segment = text.match(/segment\s+(\d+)/i);
  if (segment) {
    const index = Number(segment[1]);
    return [{
      type: "segment",
      start: index,
      end: index,
      label: `Segment ${index}`
    }];
  }

  return undefined;
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

function findBrowserResidues(parts: Record<string, string>) {
  const pattern = /(?:-webkit-[\w-]+|webkit[\w-]*|-apple-system|BlinkMacSystemFont|Apple Color Emoji|Segoe UI Emoji)/gi;
  const hits: Array<{ part: string; value: string }> = [];
  const seen = new Set<string>();

  for (const [part, xml] of Object.entries(parts)) {
    if (!part.endsWith(".xml")) {
      continue;
    }

    for (const match of xml.matchAll(pattern)) {
      const value = decodeXml(match[0]);
      const key = `${part}:${value.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({ part, value });
      }
    }
  }

  return hits;
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

function estimateFog(text: string) {
  const words = tokenize(text);
  const sentences = splitSentences(text);
  if (words.length === 0 || sentences.length === 0) {
    return 0;
  }
  const complexWords = words.filter((word) => countSyllables(word) >= 3).length;
  return 0.4 * (words.length / sentences.length + (complexWords / words.length) * 100);
}

function typeTokenRatio(text: string) {
  const words = tokenize(text);
  return words.length ? new Set(words).size / words.length : 0;
}

function passiveDensity(text: string) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return 0;
  }

  const passiveHits = sentences.filter((sentence) =>
    /\b(?:is|are|was|were|be|been|being)\s+\w+(?:ed|en)\b(?:\s+\w+){0,3}\s+by\b/i.test(sentence) ||
    /\b(?:is|are|was|were|be|been|being)\s+\w+(?:ed|en)\b/i.test(sentence)
  ).length;

  return passiveHits / sentences.length;
}

function writingSignature(text: string) {
  const words = tokenize(text);
  const sentences = splitSentences(text);
  const lowered = text.toLowerCase();
  const transitionCount = TRANSITIONS.reduce((sum, phrase) => sum + countOccurrences(lowered, phrase), 0);
  const openerCount = sentences.filter((sentence) => /^(this|these)\s+\w+|^such\s+\w+|^it is\s+\w+|^there (is|are)\b/i.test(sentence)).length;

  return {
    fkGrade: estimateGrade(text),
    fogIndex: estimateFog(text),
    avgSentenceLength: sentences.length ? words.length / sentences.length : 0,
    avgWordLength: words.length ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
    typeTokenRatio: typeTokenRatio(text),
    formalDensity: density(text, FORMAL_ACADEMIC),
    informalDensity: density(text, INFORMAL_COLLOQUIAL),
    transitionDensity: words.length ? (transitionCount / words.length) * 1000 : 0,
    openerPercent: sentences.length ? (openerCount / sentences.length) * 100 : 0
  };
}

function compareMetric(label: string, submitted: number, authenticated: number, notableThreshold: number, criticalThreshold: number) {
  const difference = Math.abs(submitted - authenticated);
  return {
    label,
    submitted,
    authenticated,
    difference,
    severity: difference >= criticalThreshold ? "critical" as const : difference >= notableThreshold ? "notable" as const : "clear" as const
  };
}

function consistencyLabel(score: number) {
  if (score >= 85) {
    return "Consistent";
  }

  if (score >= 65) {
    return "Minor inconsistencies";
  }

  if (score >= 40) {
    return "Moderate inconsistencies";
  }

  return "Severe inconsistencies";
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

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
