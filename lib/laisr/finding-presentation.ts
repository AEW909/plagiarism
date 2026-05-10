import type { Finding, LaisrReport, Severity } from "./types";

export function severityLabel(severity: Severity) {
  return {
    info: "Info",
    notable: "Notable",
    serious: "Serious",
    critical: "Critical"
  }[severity];
}

export function recommendationClass(recommendation: LaisrReport["summary"]["recommendation"]) {
  if (recommendation.includes("Strong")) {
    return "high";
  }

  if (recommendation.includes("Viva")) {
    return "moderate";
  }

  if (recommendation.includes("review")) {
    return "watch";
  }

  return "clear";
}

export function finalJudgementReady(report: LaisrReport) {
  return report.aiReview.status === "completed";
}

export function aiStatus(status: LaisrReport["aiReview"]["status"]) {
  return {
    completed: "AI review and synthesis completed",
    failed: "AI review unavailable",
    pending: "AI review in progress",
    not_configured: "AI review not configured"
  }[status];
}

export function plainFindingSummary(finding: Finding) {
  if (finding.id === "rels-custom-xml") {
    return "This Word file contains extra hidden data sections used by templates, forms, SharePoint, reference managers, or document-management systems. It does not mean text was copied, but it tells the examiner the file may have started from, or passed through, a structured template/workflow rather than being a completely plain essay file.";
  }

  if (finding.id === "rels-external-targets") {
    return "The DOCX contains links to something outside the file. These may simply be references or hyperlinks, but they can also preserve traces of web content, linked images, or material inserted from another location.";
  }

  if (finding.id === "rels-embedded-objects") {
    return "The submission contains another file or object tucked inside the Word document, such as a spreadsheet, package, or embedded item. That object may have its own source history, so it is worth checking what it is and why it is there.";
  }

  if (finding.id === "rels-altchunk-targets") {
    return "Word has a special import mechanism called altChunk for pulling in external HTML or document content. Seeing it in an essay is unusual because it means material was mechanically imported rather than simply typed into the document.";
  }

  if (finding.id === "rels-image-alt-text") {
    return "An image or drawing inside the file carries metadata that looks source-like. This may reveal where an image came from, how it was inserted, or whether it was generated or copied from another context.";
  }

  if (finding.id === "xml-rsid-missing-from-settings") {
    return "Some paragraphs use Word edit-session IDs that are present in the body of the document but absent from Word's main session list. That mismatch can happen when text has been pasted or imported from elsewhere, though some conversions and templates can also produce it.";
  }

  if (finding.id === "xml-bulk-rsid-block") {
    return "A large run of text appears to share one Word edit-session marker. That can be consistent with a block being pasted in at once, but it can also happen if the student drafted elsewhere and pasted their own work into the final document.";
  }

  if (finding.id === "xml-low-rsid-diversity") {
    return "The file has very few Word edit-session markers for its length. A naturally developed Word document often accumulates more variation as it is drafted and revised, so this may suggest the final file was assembled late or copied in from another editor.";
  }

  if (finding.id === "xml-browser-fonts" || finding.id === "xml-browser-residue") {
    return "The hidden formatting contains browser-style traces such as webkit or system-font markers. These are often left behind when text is copied from a browser, web editor, or online tool into Word.";
  }

  if (finding.id === "xml-hidden-text" || finding.id === "xml-white-text") {
    return "The document contains text that may be hidden or visually disguised. This is a stronger concern because hidden text can affect word counts, similarity checking, or what an examiner can see on the page.";
  }

  if (finding.id === "xml-rsid-root") {
    return "This is the document's root edit-session identifier. It is mainly useful later for comparing multiple submissions, because matching root values can show that files came from the same starting document or template.";
  }

  if (finding.id === "package-uniform-timestamps") {
    return "Many internal files inside the DOCX were saved at almost the same moment. This can happen during normal export or cloud saving, but it can also suggest a final document was repackaged or assembled shortly before submission.";
  }

  if (finding.id.startsWith("metadata-")) {
    return "This comes from the Word file's document properties, such as author, editor, template, editing time, or revision count. These fields are useful process clues, but they are not reliable enough to stand alone.";
  }

  if (finding.id.startsWith("text-sub-")) {
    return "The essay uses a word that appears oddly chosen for its surrounding context. These strange synonym substitutions can occur after paraphrasing, translation, or AI rewriting, but they can also be ordinary student word-choice errors.";
  }

  if (finding.id.startsWith("text-merge-") || finding.id.startsWith("text-compound-")) {
    return "Two words appear to have been joined together without the expected space or hyphen. This often happens when text is copied from a PDF or processed by an automated tool, but it can also be a simple typing mistake.";
  }

  if (finding.id.startsWith("text-grammar-") || finding.id === "text-studies-is") {
    return "This is a small grammar or phrasing irregularity. It matters most when the surrounding writing is otherwise very polished, because that contrast can hint at patching, copying, or uneven editing.";
  }

  if (finding.id === "style-transitions") {
    return "The essay uses formal linking phrases unusually often. That can make writing feel generated or over-smoothed, especially if many paragraphs follow the same rhythm.";
  }

  if (finding.id.startsWith("style-near-dup-")) {
    return "Two paragraphs share a lot of the same word patterns. That may indicate repeated filler, patchwriting, or recycled text, though literature reviews can legitimately revisit similar ideas.";
  }

  if (finding.id === "style-openers") {
    return "Many sentences start in the same formal pattern. This is a style signal rather than proof: it can point to templated or AI-assisted prose, but some students naturally write repetitively.";
  }

  if (finding.id === "ling-consistency-score") {
    return "Several sections differ from the document's usual writing pattern. This score combines complexity, formal wording, and passive voice, and is meant to highlight places worth discussing in viva.";
  }

  if (finding.id.startsWith("ling-grade-")) {
    return "One section is noticeably simpler or more complex than the document's normal level. A shift like this can be innocent, but it is a good place to ask the candidate to explain the argument in their own words.";
  }

  if (finding.id.startsWith("ling-register-")) {
    return "One section suddenly uses more formal academic wording than the rest of the essay. That can happen in a technical passage, but it may also suggest imported, heavily edited, or AI-assisted prose.";
  }

  if (finding.id.startsWith("ling-passive-")) {
    return "One section uses passive constructions more heavily than the rest of the document. Passive voice is normal in academic writing, but a sudden spike can mark a different source or drafting style.";
  }

  if (finding.id.startsWith("compare-")) {
    return "This compares the submission with a known sample of the candidate's own writing. It is often more meaningful than a generic benchmark, because it asks whether this essay sounds like this particular student's usual style.";
  }

  if (finding.category === "XML Forensics") {
    return "This comes from the hidden structure inside the Word file rather than from the visible essay text. It is a provenance clue: useful for deciding what to ask about, but not proof by itself.";
  }

  if (finding.category === "Relationships and Embedded Objects") {
    return "This checks hidden package relationships inside the DOCX. These can show links, imported content, embedded files, or template data that are not obvious from the visible essay page.";
  }

  if (finding.category === "Linguistic Consistency") {
    return "This compares one section with the candidate's own writing pattern in the rest of the document. A highlighted section is not automatically suspicious, but it is a useful place to test understanding.";
  }

  if (finding.category === "Stylometric Indicators") {
    return "This looks for repeated wording patterns across the essay. Repetition can be normal, but concentrated repetition may suggest generated filler, patchwriting, or heavy paraphrasing.";
  }

  if (finding.category === "Textual Anomalies") {
    return "This is a visible writing-level signal, such as an odd substitution or formatting artefact. It should be checked in context and discussed with the candidate if it matters.";
  }

  if (finding.category === "Document Metadata" || finding.category === "Package Forensics") {
    return "This comes from the file history and packaging information. It can show editing workflow clues, but it can also be affected by templates, cloud saves, exports, or shared devices.";
  }

  return "This is a review signal, not an accusation. It should be read alongside the rest of the evidence, including possible direct copying, close paraphrase, undisclosed assistance, process evidence, and any explanation the candidate can give.";
}

export function plainFindingObservation(finding: Finding) {
  const evidence = finding.evidence;
  const quotedValues = [...evidence.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const numberMatch = evidence.match(/\b(\d+(?:\.\d+)?)\b/);
  const firstNumber = numberMatch?.[1];

  if (finding.id === "rels-custom-xml") {
    return specificFromNumber(evidence, "custom XML part", "The submitted DOCX contains extra hidden custom-data sections inside the file package.");
  }

  if (finding.id === "rels-external-targets") {
    return specificFromNumber(evidence, "external relationship target", "The submitted DOCX contains one or more links to resources outside the file.");
  }

  if (finding.id === "rels-embedded-objects") {
    return specificFromNumber(evidence, "embedded object/package part", "The submitted DOCX contains embedded material inside the Word file.");
  }

  if (finding.id === "rels-altchunk-targets") {
    return "The Word package contains an altChunk relationship, meaning Word has recorded that content was imported into the document through an import mechanism.";
  }

  if (finding.id === "rels-image-alt-text") {
    return quotedValues.length
      ? `An image or drawing in the document carries source-like metadata: ${quotedValues.slice(0, 3).join(", ")}.`
      : "An image or drawing in the document carries metadata that looks like it may describe a source or generation context.";
  }

  if (finding.id === "xml-rsid-missing-from-settings") {
    return firstNumber
      ? `${firstNumber} paragraph${firstNumber === "1" ? "" : "s"} use edit-session IDs that are not listed in Word's main session table.`
      : "Some paragraphs use edit-session IDs that are missing from Word's main session table.";
  }

  if (finding.id === "xml-bulk-rsid-block") {
    return firstNumber
      ? `${firstNumber} large block${firstNumber === "1" ? "" : "s"} of text share a single Word edit-session marker.`
      : "A large run of text shares one Word edit-session marker.";
  }

  if (finding.id === "xml-low-rsid-diversity") {
    const words = evidence.match(/about ([\d,]+) words/i)?.[1];
    const rsids = evidence.match(/only (\d+) unique/i)?.[1];
    return words && rsids
      ? `The document has about ${words} words but only ${rsids} unique Word edit-session marker${rsids === "1" ? "" : "s"}.`
      : "The document has unusually low edit-session variation for its length.";
  }

  if (finding.id === "xml-rsid") {
    const unique = evidence.match(/contains (\d+) unique/i)?.[1];
    const paragraphs = evidence.match(/across (\d+) paragraphs/i)?.[1];
    return unique && paragraphs
      ? `The document contains ${unique} different Word edit-session markers across ${paragraphs} paragraphs.`
      : "The document contains an unusual number of Word edit-session markers.";
  }

  if (finding.id === "xml-rsid-root") {
    return quotedValues[0]
      ? `The document's root edit-session value is ${quotedValues[0]}.`
      : "The document has a root edit-session value recorded in its Word settings.";
  }

  if (finding.id === "xml-browser-fonts" || finding.id === "xml-browser-residue") {
    return quotedValues.length
      ? `The hidden XML contains browser-style marker${quotedValues.length === 1 ? "" : "s"} such as ${quotedValues.slice(0, 4).join(", ")}.`
      : "The hidden XML contains browser-style formatting residue.";
  }

  if (finding.id === "xml-hidden-text" || finding.id === "xml-white-text") {
    return quotedValues.length
      ? `LAISR found text that may be hidden or visually disguised: "${clipForUi(quotedValues[0], 120)}".`
      : "LAISR found text that may be hidden or visually disguised.";
  }

  if (finding.id === "package-uniform-timestamps") {
    const parts = evidence.match(/^(\d+) high-value/i)?.[1];
    const seconds = evidence.match(/within (\d+) seconds/i)?.[1];
    return parts && seconds
      ? `${parts} important internal DOCX files have timestamps within ${seconds} seconds of each other.`
      : "Several important internal DOCX files have almost identical timestamps.";
  }

  if (finding.id === "metadata-author") {
    return quotedValues.length >= 2
      ? `The file creator is listed as "${quotedValues[0]}", but the last editor is "${quotedValues[1]}".`
      : "The file creator and last editor fields do not match.";
  }

  if (finding.id === "metadata-revisions") {
    const revisions = evidence.match(/reports (\d+) revisions/i)?.[1];
    const pages = evidence.match(/across (\d+) pages/i)?.[1];
    return revisions && pages
      ? `The file reports ${revisions} revisions across ${pages} pages.`
      : "The file reports a high revision count for its length.";
  }

  if (finding.id === "metadata-low-edit-time") {
    const minutes = evidence.match(/reports (\d+) minutes/i)?.[1];
    const words = evidence.match(/for ([\d,]+) words/i)?.[1];
    return minutes && words
      ? `The file records only ${minutes} minute${minutes === "1" ? "" : "s"} of editing time for ${words} words.`
      : "The file records very little editing time for the amount of text.";
  }

  if (finding.id === "metadata-template") {
    return quotedValues[0]
      ? `The file records its template as "${quotedValues[0]}".`
      : "The file records a specific template rather than a plain default document.";
  }

  if (finding.id === "metadata-company") {
    return quotedValues[0]
      ? `The file contains company or organisation metadata: "${quotedValues[0]}".`
      : "The file contains company or organisation metadata.";
  }

  if (finding.id.startsWith("text-sub-")) {
    return quotedValues.length
      ? `The word "${quotedValues[0]}" appears in a sentence where it may be an odd substitution.`
      : "A word appears in a context where it may be an odd substitution.";
  }

  if (finding.id.startsWith("text-merge-") || finding.id.startsWith("text-compound-")) {
    return quotedValues.length
      ? `The token "${quotedValues[0]}" appears joined together where a space or hyphen may be expected.`
      : "A word-like token appears to be two words joined together.";
  }

  if (finding.id.startsWith("text-grammar-") || finding.id === "text-studies-is") {
    return quotedValues.length
      ? `The phrase or sentence "${clipForUi(quotedValues[0], 130)}" contains a grammar or phrasing irregularity.`
      : "LAISR found a grammar or phrasing irregularity in the visible text.";
  }

  if (finding.id === "style-transitions") {
    const count = evidence.match(/uses (\d+) formal/i)?.[1];
    const densityValue = evidence.match(/around ([\d.]+) per/i)?.[1];
    return count && densityValue
      ? `The essay uses ${count} formal transition phrases, about ${densityValue} per 1,000 words.`
      : "The essay uses formal transition phrases at a high density.";
  }

  if (finding.id.startsWith("style-near-dup-")) {
    const paragraphs = evidence.match(/Paragraphs (\d+) and (\d+)/i);
    const score = evidence.match(/score of ([\d.]+)/i)?.[1];
    return paragraphs && score
      ? `Paragraphs ${paragraphs[1]} and ${paragraphs[2]} share a five-word-pattern similarity score of ${score}.`
      : "Two paragraphs share a notable amount of repeated wording.";
  }

  if (finding.id === "style-openers") {
    const counts = evidence.match(/(\d+) of (\d+) sentences/i);
    return counts
      ? `${counts[1]} out of ${counts[2]} sentences begin with a small set of repeated formal opener patterns.`
      : "Many sentences begin with repeated formal opener patterns.";
  }

  if (finding.id === "ling-consistency-score") {
    const score = evidence.match(/score is (\d+)\/100/i)?.[1];
    return score
      ? `The document's overall writing-consistency score is ${score}/100.`
      : "The document's writing-consistency score is low enough to flag.";
  }

  if (finding.id.startsWith("ling-grade-")) {
    const segment = evidence.match(/segment (\d+)/i)?.[1] ?? finding.location?.match(/Segment (\d+)/i)?.[1];
    const grade = evidence.match(/Estimated grade: ([\d.-]+)/i)?.[1];
    const average = evidence.match(/document average: ([\d.-]+)/i)?.[1];
    return segment && grade && average
      ? `Segment ${segment} has an estimated grade level of ${grade}, compared with the document average of ${average}.`
      : "One section has a noticeably different complexity level from the rest of the document.";
  }

  if (finding.id.startsWith("ling-register-")) {
    const segment = evidence.match(/segment (\d+)/i)?.[1] ?? finding.location?.match(/Segment (\d+)/i)?.[1];
    const densityValue = evidence.match(/Formal-word density: ([\d.-]+)/i)?.[1];
    const average = evidence.match(/document average: ([\d.-]+)/i)?.[1];
    return segment && densityValue && average
      ? `Segment ${segment} has formal-word density of ${densityValue} per 100 words, compared with the document average of ${average}.`
      : "One section uses formal academic wording more densely than the rest of the document.";
  }

  if (finding.id.startsWith("ling-passive-")) {
    const segment = evidence.match(/segment (\d+)/i)?.[1] ?? finding.location?.match(/Segment (\d+)/i)?.[1];
    const densityValue = evidence.match(/Passive density: ([\d.-]+)/i)?.[1];
    const average = evidence.match(/document average: ([\d.-]+)/i)?.[1];
    return segment && densityValue && average
      ? `Segment ${segment} has passive-voice density of ${densityValue} per sentence, compared with the document average of ${average}.`
      : "One section uses passive voice more heavily than the rest of the document.";
  }

  if (finding.id === "compare-overall") {
    const score = evidence.match(/scored (\d+)\/100/i)?.[1];
    return score
      ? `Compared with the authenticated sample, this submission scored ${score}/100 for stylistic similarity.`
      : "The submission differs from the authenticated writing sample across one or more style measures.";
  }

  if (finding.id.startsWith("compare-")) {
    const submitted = evidence.match(/Submitted value: ([\d.-]+)/i)?.[1];
    const authenticated = evidence.match(/Authenticated sample: ([\d.-]+)/i)?.[1];
    const difference = evidence.match(/Difference: ([\d.-]+)/i)?.[1];
    return submitted && authenticated && difference
      ? `This metric is ${submitted} in the submission and ${authenticated} in the authenticated sample, a difference of ${difference}.`
      : "One writing-style metric differs from the authenticated sample.";
  }

  return evidence;
}

export function getFindingParagraphRange(finding: Finding, paragraphCount: number) {
  const paragraphAnchor = finding.anchors?.find((anchor) => anchor.type === "paragraph");
  if (paragraphAnchor?.start) {
    const start = clampParagraph(paragraphAnchor.start, paragraphCount);
    const end = clampParagraph(paragraphAnchor.end || paragraphAnchor.start, paragraphCount);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  const segmentAnchor = finding.anchors?.find((anchor) => anchor.type === "segment");
  if (segmentAnchor?.start) {
    const start = clampParagraph((segmentAnchor.start - 1) * 3 + 1, paragraphCount);
    const end = clampParagraph(start + 2, paragraphCount);
    return { start, end };
  }

  const text = `${finding.location || ""} ${finding.evidence}`;
  const explicitRange = text.match(/paragraphs?\s+(\d+)(?:[-\u2013](\d+))?/i);

  if (explicitRange) {
    const start = clampParagraph(Number(explicitRange[1]), paragraphCount);
    const end = clampParagraph(Number(explicitRange[2] || explicitRange[1]), paragraphCount);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  const segment = text.match(/segment\s+(\d+)/i);
  if (segment) {
    const start = clampParagraph((Number(segment[1]) - 1) * 3 + 1, paragraphCount);
    const end = clampParagraph(start + 2, paragraphCount);
    return { start, end };
  }

  return null;
}

export function paragraphInRange(index: number, range: { start: number; end: number } | null) {
  return Boolean(range && index >= range.start && index <= range.end);
}

function clampParagraph(index: number, paragraphCount: number) {
  if (!Number.isFinite(index) || paragraphCount <= 0) {
    return 1;
  }

  return Math.min(paragraphCount, Math.max(1, Math.round(index)));
}

function specificFromNumber(evidence: string, noun: string, fallback: string) {
  const match = evidence.match(/\b(\d+)\b/);
  if (!match) {
    return fallback;
  }

  const count = match[1];
  return `The submitted DOCX contains ${count} ${noun}${count === "1" ? "" : "s"}.`;
}

function clipForUi(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length - 1)}...`;
}
