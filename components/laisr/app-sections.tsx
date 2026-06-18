"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  FileQuestion,
  FileSearch,
  Files,
  FileText,
  Loader2,
  Scale,
  SearchCheck,
  Upload,
  Users
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  aiStatus,
  finalJudgementReady,
  getFindingParagraphRange,
  paragraphInRange,
  plainFindingObservation,
  plainFindingSummary,
  severityLabel
} from "@/lib/laisr/finding-presentation";
import type { AlgorithmicSection } from "@/lib/laisr/sections";
import type { FinalRecommendation, LaisrReport, ReviewSectionId, SectionAiReview } from "@/lib/laisr/types";
import {
  OutcomeScale,
  SummaryItem
} from "./ui-primitives";
export function HomeOptions({ onSingleUpload }: { onSingleUpload: () => void }) {
  return (
    <section className="home-grid">
      <button className="home-option active" type="button" onClick={onSingleUpload}>
        <FileSearch size={24} />
        <span>
          <strong>Single file review</strong>
          <small>Upload one DOCX submission, add an optional authenticated sample, and generate a tabbed evidence report.</small>
        </span>
      </button>
      <button className="home-option disabled" type="button" disabled>
        <Files size={24} />
        <span>
          <strong>Class set review</strong>
          <small>Batch upload and compare a cohort systematically. Planned for a later build.</small>
        </span>
      </button>
      <button className="home-option disabled" type="button" disabled>
        <Clock size={24} />
        <span>
          <strong>Historical reports</strong>
          <small>Saved submissions and report history when Supabase storage is added.</small>
        </span>
      </button>
    </section>
  );
}

export function SingleUploadScreen({
  aiLoading,
  analysisStage,
  authenticatedFile,
  candidateId,
  error,
  file,
  loading,
  subject,
  onAnalyse,
  onAuthenticatedFileChange,
  onBack,
  onCandidateIdChange,
  onFileChange,
  onSubjectChange
}: {
  aiLoading: boolean;
  analysisStage: "idle" | "deterministic" | "ai" | "complete";
  authenticatedFile: File | null;
  candidateId: string;
  error: string;
  file: File | null;
  loading: boolean;
  subject: string;
  onAnalyse: () => void;
  onAuthenticatedFileChange: (file: File | null) => void;
  onBack: () => void;
  onCandidateIdChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubjectChange: (value: string) => void;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-title">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to home">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1>Single file review</h1>
          <p>Upload a DOCX submission and collect review signals before deciding whether a viva is warranted.</p>
        </div>
      </div>

      <div className="upload-workspace">
        <div className="upload-stack">
          <label className="upload-zone">
            <Upload size={30} />
            <strong>{file ? file.name : "Choose DOCX submission"}</strong>
            <span>Document text and XML are analysed in this session.</span>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="upload-zone compact">
            <FileText size={24} />
            <strong>{authenticatedFile ? authenticatedFile.name : "Optional authenticated sample"}</strong>
            <span>Known student writing enables a style comparison.</span>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => onAuthenticatedFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="details-panel">
          <label>
            Candidate ID
            <input
              value={candidateId}
              placeholder="Optional"
              onChange={(event) => onCandidateIdChange(event.target.value)}
            />
          </label>
          <label>
            Subject or title
            <input
              value={subject}
              placeholder="Optional"
              onChange={(event) => onSubjectChange(event.target.value)}
            />
          </label>
          <button className="primary-button" type="button" disabled={loading} onClick={onAnalyse}>
            {loading ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
            {loading ? "Checking evidence" : "Analyse document"}
          </button>
          {aiLoading ? (
            <div className="analysis-progress">
              <Loader2 className="spin" size={15} />
              AI is reviewing source use, authorship, paraphrasing, plagiarism, and AI-writing indicators
            </div>
          ) : null}
          {analysisStage !== "idle" ? <ProgressRail stage={analysisStage} hasAuthenticatedSample={Boolean(authenticatedFile)} /> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function SectionReviewTab({
  aiConfigured,
  aiLoading,
  aiReview,
  onRunAi,
  report,
  section
}: {
  aiConfigured: boolean;
  aiLoading: boolean;
  aiReview?: SectionAiReview;
  onRunAi: () => void;
  report: LaisrReport;
  section: AlgorithmicSection;
}) {
  const effectiveJudgement = section.id === "ai_prose" && aiReview
    ? aiConcernLabel(aiReview.concern)
    : section.judgement;

  return (
    <div className="section-review">
      <SectionHeader
        aiConfigured={aiConfigured}
        aiLoading={aiLoading}
        aiReview={aiReview}
        judgement={effectiveJudgement}
        onRunAi={onRunAi}
        section={section}
      />

      {section.id === "metadata" ? (
        <MetadataSection report={report} section={section} />
      ) : null}
      {section.id === "textual" ? (
        <TextualSection report={report} section={section} />
      ) : null}
      {section.id === "comparative" ? (
        <ComparativeSection report={report} section={section} />
      ) : null}
      {section.id === "ai_prose" ? (
        <AiProseSection report={report} />
      ) : null}
    </div>
  );
}

export function SummaryRecommendationTab({
  completedAiReviews,
  finalRecommendation,
  generatingSummary,
  includeVivaInPdf,
  onCreateSummary,
  onDownloadJson,
  onDownloadPdf,
  onToggleViva,
  pdfLoading,
  report,
  section
}: {
  completedAiReviews: SectionAiReview[];
  finalRecommendation: FinalRecommendation | null;
  generatingSummary: boolean;
  includeVivaInPdf: boolean;
  onCreateSummary: () => void;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
  onToggleViva: (value: boolean) => void;
  pdfLoading: boolean;
  report: LaisrReport;
  section: AlgorithmicSection;
}) {
  const vivaRecommended =
    finalRecommendation?.recommendation === "Viva recommended" ||
    finalRecommendation?.recommendation === "Strong viva recommended";

  return (
    <div className="section-review">
      <section className="panel section-intro tone-not_run">
        <div>
          <p className="eyebrow">Final step</p>
          <h2>{section.label}</h2>
          <p>{section.description}</p>
        </div>
        <div className="section-actions">
          <button className="primary-button" type="button" disabled={generatingSummary} onClick={onCreateSummary}>
            {generatingSummary ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            {finalRecommendation ? "Update summary" : "View/Create Summary"}
          </button>
        </div>
        <p className="section-summary">
          {finalRecommendation
            ? `${finalRecommendation.source === "ai_assisted" ? "AI-assisted" : "Deterministic"} final recommendation created with a concern score of ${finalRecommendation.concernScore}/10.`
            : "No overall recommendation has been generated yet. This keeps the evidence-gathering stage separate from the final weighing stage."}
        </p>
      </section>

      {!finalRecommendation ? (
        <section className="panel reasoning-panel">
          <h2>
            <Scale size={18} />
            Summary not created yet
          </h2>
          <p>
            Review the section evidence first. When ready, create the final summary and choose which completed AI opinions,
            if any, should be included in the final weighing.
          </p>
          <p className="muted">
            Completed AI opinions available now: {completedAiReviews.length}.
          </p>
        </section>
      ) : null}

      {finalRecommendation ? (
      <section className="panel">
        <h2>
          <AlertTriangle size={18} />
          Outcome scale
        </h2>
        <OutcomeScale activeRecommendation={finalRecommendation.recommendation} />
      </section>
      ) : null}

      {finalRecommendation ? (
      <section className="panel reasoning-panel">
        <h2>
          <CheckCircle2 size={18} />
          Final recommendation
        </h2>
        <p>{finalRecommendation.rationale}</p>
        <p className="muted">
          Included AI section opinions: {finalRecommendation.includedAiSections.length
            ? finalRecommendation.includedAiSections.map(sectionLabel).join(", ")
            : "None"}. Final AI weighing: {finalRecommendation.includedFinalAiOpinion ? "included" : "not included"}.
        </p>
      </section>
      ) : null}

      <section className="panel">
        <div className="judgement-header">
          <h2>
            <Download size={18} />
            Report export
          </h2>
          {vivaRecommended ? (
            <label className="toggle-row">
              <input
                checked={includeVivaInPdf}
                type="checkbox"
                onChange={(event) => onToggleViva(event.target.checked)}
              />
              Include viva questions in PDF
            </label>
          ) : null}
        </div>

        <div className="report-actions solid">
          <button className="primary-button" type="button" disabled={pdfLoading || !finalRecommendation} onClick={onDownloadPdf}>
            {pdfLoading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
            Download PDF
          </button>
          <button className="outline-button" type="button" onClick={onDownloadJson}>
            JSON
          </button>
        </div>
      </section>

      {vivaRecommended ? (
        <section className="panel">
          <h2>
            <FileQuestion size={18} />
            Viva options
          </h2>
          <details className="viva-details">
            <summary>
              Suggested viva questions
              <span>{report.vivaQuestions.length} generated</span>
            </summary>
            <div className="question-list">
              {report.vivaQuestions.map((question, index) => (
                <div className="question" key={`${question.question}-${index}`}>
                  <strong>{index + 1}. {question.question}</strong>
                  <p>{question.rationale}</p>
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

export function SummaryCreationModal({
  aiConfigured,
  completedAiReviews,
  generating,
  onClose,
  onCreate
}: {
  aiConfigured: boolean;
  completedAiReviews: SectionAiReview[];
  generating: boolean;
  onClose: () => void;
  onCreate: (options: {
    includeFinalAiOpinion: boolean;
    selectedAiSectionIds: ReviewSectionId[];
  }) => void;
}) {
  const [selectedSections, setSelectedSections] = useState<ReviewSectionId[]>(
    completedAiReviews.map((review) => review.sectionId)
  );
  const [includeFinalAiOpinion, setIncludeFinalAiOpinion] = useState(false);

  function toggleSection(sectionId: ReviewSectionId) {
    setSelectedSections((current) =>
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId]
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-modal-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Final weighing</p>
            <h2 id="summary-modal-title">Create final summary</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close summary options">
            ×
          </button>
        </div>

        {completedAiReviews.length > 0 ? (
          <div className="modal-section">
            <strong>Completed AI opinions to include</strong>
            <p>Select which completed section AI opinions should contribute their text and 1-10 concern scores.</p>
            <div className="modal-checks">
              {completedAiReviews.map((review) => (
                <label className="modal-check" key={review.sectionId}>
                  <input
                    checked={selectedSections.includes(review.sectionId)}
                    type="checkbox"
                    onChange={() => toggleSection(review.sectionId)}
                  />
                  <span>
                    <strong>{sectionLabel(review.sectionId)}</strong>
                    <small>{aiConcernLabel(review.concern)} · {review.concernScore}/10</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="modal-section">
            <strong>No completed AI section opinions yet</strong>
            <p>
              You can still create a final recommendation from the algorithmic section scores. No section AI text or
              section AI scores will be included.
            </p>
          </div>
        )}

        <div className="modal-section">
          <label className="modal-check">
            <input
              checked={includeFinalAiOpinion}
              disabled={!aiConfigured}
              type="checkbox"
              onChange={(event) => setIncludeFinalAiOpinion(event.target.checked)}
            />
            <span>
              <strong>Include AI final weighing opinion</strong>
              <small>
                {aiConfigured
                  ? "AI will weigh the evidence summaries and selected AI opinions, without raw essay text."
                  : "OPENAI_API_KEY is not configured, so this option is unavailable."}
              </small>
            </span>
          </label>
        </div>

        <div className="modal-actions">
          <button className="outline-button" type="button" disabled={generating} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={generating}
            onClick={() => onCreate({ includeFinalAiOpinion, selectedAiSectionIds: selectedSections })}
          >
            {generating ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            {includeFinalAiOpinion ? "Generate with AI" : "Create summary"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProgressRail({
  hasAuthenticatedSample,
  stage
}: {
  hasAuthenticatedSample: boolean;
  stage: "idle" | "deterministic" | "ai" | "complete";
}) {
  const steps = [
    "Load DOCX",
    "Metadata",
    "XML",
    "Text",
    "Style",
    "Linguistic",
    ...(hasAuthenticatedSample ? ["Compare sample"] : []),
    "Evidence synthesis",
    "Judgement"
  ];
  const activeIndex =
    stage === "deterministic"
      ? hasAuthenticatedSample ? 6 : 5
      : stage === "ai"
        ? steps.length - 2
        : stage === "complete"
          ? steps.length - 1
          : 0;

  return (
    <div className="progress-rail">
      {steps.map((step, index) => (
        <div
          className={
            index < activeIndex || stage === "complete"
              ? "progress-step done"
              : index === activeIndex
                ? "progress-step active"
                : "progress-step"
          }
          key={step}
        >
          <span>{index < activeIndex || stage === "complete" ? <CheckCircle2 size={13} /> : index + 1}</span>
          <small>{step}</small>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  aiConfigured,
  aiLoading,
  aiReview,
  judgement,
  onRunAi,
  section
}: {
  aiConfigured: boolean;
  aiLoading: boolean;
  aiReview?: SectionAiReview;
  judgement: string;
  onRunAi: () => void;
  section: AlgorithmicSection;
}) {
  return (
    <section className={`panel section-intro tone-${section.tone}`}>
      <div>
        <p className="eyebrow">{section.available ? "Section judgement" : "Optional section"}</p>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </div>
      <div className="section-actions">
        <mark className={`section-judgement tone-${section.tone}`}>{judgement}</mark>
        <button
          className="ai-review-button"
          type="button"
          disabled={!aiConfigured || aiLoading || !section.available}
          onClick={onRunAi}
          title={aiConfigured ? "Ask AI for a scoped second opinion" : "OPENAI_API_KEY is not configured"}
        >
          {aiLoading ? <Loader2 className="spin" size={16} /> : <span aria-hidden="true">🤖</span>}
          <span>{aiLoading ? "Reviewing" : "AI"}</span>
        </button>
      </div>
      <p className="section-summary">{section.summary}</p>
      {aiReview ? <SectionAiPanel review={aiReview} /> : null}
    </section>
  );
}

function SectionAiPanel({ review }: { review: SectionAiReview }) {
  return (
    <div className={`section-ai-panel concern-${review.concern}`}>
      <strong>AI scoped opinion: {aiConcernLabel(review.concern)} · {review.concernScore}/10</strong>
      <p>{review.opinion}</p>
    </div>
  );
}

function MetadataSection({
  report,
  section
}: {
  report: LaisrReport;
  section: AlgorithmicSection;
}) {
  return (
    <div className="findings-stack">
      <section className="panel">
        <h2>
          <FileSearch size={18} />
          File facts
        </h2>
        <div className="metadata-grid">
          <SummaryItem label="Creator" value={report.metadata.creator} />
          <SummaryItem label="Last editor" value={report.metadata.lastModifiedBy} />
          <SummaryItem label="Revision" value={report.metadata.revision} />
          <SummaryItem label="Application" value={report.metadata.application} />
          <SummaryItem label="Template" value={report.metadata.template} />
          <SummaryItem label="Company" value={report.metadata.company} />
        </div>
      </section>
      <SectionFindings findings={section.findings} emptyText="No metadata or file-forensic indicators were detected." />
    </div>
  );
}

function TextualSection({
  report,
  section
}: {
  report: LaisrReport;
  section: AlgorithmicSection;
}) {
  const [mode, setMode] = useState<"reader" | "map" | "findings">("reader");

  return (
    <div className="findings-stack">
      <section className="panel evidence-overview">
        <div className="panel-heading-row">
          <h2>
            <SearchCheck size={18} />
            Locate issues in the document
          </h2>
          <div className="segmented-control" aria-label="Textual view mode">
            <button className={mode === "reader" ? "active" : ""} type="button" onClick={() => setMode("reader")}>
              Document
            </button>
            <button className={mode === "map" ? "active" : ""} type="button" onClick={() => setMode("map")}>
              Style map
            </button>
            <button className={mode === "findings" ? "active" : ""} type="button" onClick={() => setMode("findings")}>
              Findings
            </button>
          </div>
        </div>
        {mode === "reader" ? <DocumentAnnotationView report={report} findings={section.findings} /> : null}
        {mode === "map" ? <LinguisticMap report={report} /> : null}
        {mode === "findings" ? <SectionFindings findings={section.findings} emptyText="No textual, tone, or style indicators were detected." /> : null}
      </section>
    </div>
  );
}

function ComparativeSection({
  report,
  section
}: {
  report: LaisrReport;
  section: AlgorithmicSection;
}) {
  return (
    <div className="findings-stack">
      <ComparativePanel report={report} />
      <SectionFindings findings={section.findings} emptyText="No authenticated-sample comparison indicators were detected." />
    </div>
  );
}

function AiProseSection({ report }: { report: LaisrReport }) {
  return (
    <section className="panel reasoning-panel">
      <h2>
        <Bot size={18} />
        Text-only AI opinion
      </h2>
      <p>
        This optional section sends only the visible essay text to the model. It does not include metadata,
        XML, RSIDs, deterministic findings, or authenticated-writing comparison data.
      </p>
      <p className="muted">
        The submitted text preview contains {report.summary.wordCount} words. Run the AI button above to ask whether
        the prose itself suggests AI use or AI-assisted rewriting.
      </p>
    </section>
  );
}

function SectionFindings({
  emptyText,
  findings
}: {
  emptyText: string;
  findings: LaisrReport["findings"];
}) {
  if (findings.length === 0) {
    return (
      <section className="panel">
        <p className="muted">{emptyText}</p>
      </section>
    );
  }

  return (
    <div className="finding-list">
      {findings.map((finding) => (
        <FindingCard finding={finding} key={finding.id} />
      ))}
    </div>
  );
}

function aiConcernLabel(concern: SectionAiReview["concern"]) {
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

function sectionLabel(sectionId: ReviewSectionId) {
  if (sectionId === "metadata") {
    return "Metadata and file forensics";
  }

  if (sectionId === "textual") {
    return "Textual anomalies, tone and style";
  }

  if (sectionId === "comparative") {
    return "Authenticated writing comparison";
  }

  if (sectionId === "ai_prose") {
    return "AI prose opinion";
  }

  return "Summary";
}

export function EvidenceTab({
  report
}: {
  report: LaisrReport;
}) {
  const [mode, setMode] = useState<"checklist" | "reader">("reader");

  return (
    <div className="findings-stack">
      <article className="panel evidence-overview">
        <div className="panel-heading-row">
          <h2>
            <SearchCheck size={18} />
            Evidence
          </h2>
          <div className="segmented-control" aria-label="Evidence view mode">
            <button className={mode === "reader" ? "active" : ""} type="button" onClick={() => setMode("reader")}>
              Document
            </button>
            <button className={mode === "checklist" ? "active" : ""} type="button" onClick={() => setMode("checklist")}>
              Checklist
            </button>
          </div>
        </div>
        {mode === "reader" ? <DocumentAnnotationView report={report} /> : <EvidenceChecklist report={report} />}
      </article>
    </div>
  );
}

export function EvidenceChecklist({ report }: { report: LaisrReport }) {
  return (
    <div className="checklist">
          {report.evidenceChecks.map((check) => (
            <details className="check-row" key={check.id}>
          <summary>
            <span>
              <strong>{check.label}</strong>
              <small>{check.summary}</small>
            </span>
            <mark className={`tag ${check.status}`}>
              {check.status === "issues"
                ? "Issues detected"
                : check.status === "pending"
                  ? "Pending"
                  : check.status === "not_run"
                    ? "Not run"
                    : "Clear"}
            </mark>
          </summary>
          <div className="check-detail">
            <p>{check.detail}</p>
            {check.id === "metadata" ? (
              <div className="metadata-grid">
                <SummaryItem label="Creator" value={report.metadata.creator} />
                <SummaryItem label="Last editor" value={report.metadata.lastModifiedBy} />
                <SummaryItem label="Revision" value={report.metadata.revision} />
                <SummaryItem label="Application" value={report.metadata.application} />
              </div>
            ) : null}
            {check.id === "ai" ? (
              <div className="ai-copy">
                <p>{report.aiReview.evidenceOpinion}</p>
              </div>
            ) : null}
            {check.id === "linguistic" ? <LinguisticMap report={report} /> : null}
            {check.id === "comparative" ? <ComparativePanel report={report} /> : null}
            {check.findingIds.length > 0 ? (
              <div className="finding-list">
                {check.findingIds.map((findingId) => {
                  const finding = report.findings.find((item) => item.id === findingId);
                  return finding ? <FindingCard key={finding.id} finding={finding} /> : null;
                })}
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

export function DocumentAnnotationView({
  findings,
  report
}: {
  findings?: LaisrReport["findings"];
  report: LaisrReport;
}) {
  const paragraphs = report.extractedTextPreview
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const scopedFindings = findings || report.findings;
  const paragraphAnnotations = scopedFindings.filter((finding) => getFindingParagraphRange(finding, paragraphs.length));
  const fileAnnotations = scopedFindings.filter((finding) => !getFindingParagraphRange(finding, paragraphs.length));

  return (
    <div className="annotation-layout">
      <div className="document-reader" aria-label="Extracted document text">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => {
            const annotations = paragraphAnnotations.filter((finding) => paragraphInRange(index + 1, getFindingParagraphRange(finding, paragraphs.length)));
            return (
              <section className={annotations.length ? "reader-paragraph annotated" : "reader-paragraph"} id={`paragraph-${index + 1}`} key={`${index}-${paragraph.slice(0, 20)}`}>
                <div className="paragraph-index">{index + 1}</div>
                <p>{paragraph}</p>
                {annotations.length ? (
                  <div className="paragraph-markers">
                    {annotations.slice(0, 4).map((finding) => (
                      <a className={`marker ${finding.severity}`} href={`#annotation-${finding.id}`} key={finding.id}>
                        {severityLabel(finding.severity)}
                      </a>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <p className="muted">No extracted document text is available for this file.</p>
        )}
      </div>

      <aside className="annotation-panel" aria-label="Evidence annotations">
        <div className="annotation-group">
          <h3>Linked to text</h3>
          {paragraphAnnotations.length > 0 ? (
            paragraphAnnotations.map((finding) => {
              const range = getFindingParagraphRange(finding, paragraphs.length);
              return (
                <AnnotationCard finding={finding} href={range ? `#paragraph-${range.start}` : undefined} key={finding.id} />
              );
            })
          ) : (
            <p className="muted">No findings could be linked to a visible paragraph yet.</p>
          )}
        </div>
        <div className="annotation-group">
          <h3>File-level evidence</h3>
          {fileAnnotations.length > 0 ? (
            fileAnnotations.map((finding) => <AnnotationCard finding={finding} key={finding.id} />)
          ) : (
            <p className="muted">No file-level findings detected.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export function AnnotationCard({
  finding,
  href
}: {
  finding: LaisrReport["findings"][number];
  href?: string;
}) {
  return (
    <article className={`annotation-card ${finding.severity}`} id={`annotation-${finding.id}`}>
      <div>
        <span>{severityLabel(finding.severity)}</span>
        <strong>{finding.title}</strong>
      </div>
      <p>{plainFindingObservation(finding)}</p>
      {href ? <a href={href}>Show in document</a> : <small>File-level finding</small>}
    </article>
  );
}

export function InterpretationTab({ report }: { report: LaisrReport }) {
  return (
    <div className="reasoning-stack">
      <ReasoningBlock
        body={report.interpretation}
        icon={<FileText size={18} />}
        title="Interpretation of the evidence"
      />
      <section className="panel ai-panel">
        <h2>
          <Brain size={18} />
          AI Evidence Synthesis
        </h2>
        <p className="status-pill">{aiStatus(report.aiReview.status)}</p>
        <div className="ai-copy">
          <p>{report.aiReview.opinion}</p>
          <p>{report.aiReview.assessment}</p>
        </div>
      </section>
    </div>
  );
}

export function CounterArgumentTab({ report }: { report: LaisrReport }) {
  return (
    <div className="reasoning-stack">
      <ReasoningBlock
        body={report.counterArgument}
        icon={<Users size={18} />}
        title="Plausible innocent explanations"
      />
      <ReasoningBlock
        body={report.aiReview.counterArgument}
        icon={<Brain size={18} />}
        title="AI synthesis counter-position"
      />
    </div>
  );
}

export function JudgementTab({
  includeVivaInPdf,
  onDownloadJson,
  onDownloadPdf,
  onToggleViva,
  pdfLoading,
  report
}: {
  includeVivaInPdf: boolean;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
  onToggleViva: (value: boolean) => void;
  pdfLoading: boolean;
  report: LaisrReport;
}) {
  const judgementReady = finalJudgementReady(report);
  const vivaRecommended =
    judgementReady &&
    (report.summary.recommendation === "Viva recommended" ||
      report.summary.recommendation === "Strong viva recommended");
  const judgementBody =
    judgementReady
      ? report.aiReview.assessment
      : report.aiReview.status === "failed"
        ? "The final judgement is not available because the AI review failed. The evidence remains available, but LAISR should not present an overall judgement until the weighing step completes."
        : report.aiReview.status === "not_configured"
          ? "The evidence has been gathered, but final judgement needs the text-only AI review and evidence-synthesis step. Add OPENAI_API_KEY to enable the final judgement stage."
          : "The evidence has been gathered. Final judgement will appear when the AI has completed the text-only review, counter-position, and overall evidence weighing.";

  return (
    <div className="reasoning-stack">
      <section className="panel">
        <h2>
          <AlertTriangle size={18} />
          Outcome scale
        </h2>
        <OutcomeScale activeRecommendation={judgementReady ? report.summary.recommendation : undefined} />
      </section>

      <ReasoningBlock
        body={judgementBody}
        icon={<CheckCircle2 size={18} />}
        title={judgementReady ? "Final evidence-weighted judgement" : "Final judgement pending"}
      />

      <section className="panel">
        <div className="judgement-header">
          <h2>
            <Download size={18} />
            Report export
          </h2>
          {vivaRecommended ? (
            <label className="toggle-row">
              <input
                checked={includeVivaInPdf}
                type="checkbox"
                onChange={(event) => onToggleViva(event.target.checked)}
              />
              Include viva questions in PDF
            </label>
          ) : null}
        </div>

        <div className="report-actions solid">
          <button
            className="primary-button"
            type="button"
            disabled={pdfLoading || !judgementReady}
            onClick={onDownloadPdf}
          >
            {pdfLoading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
            Download PDF
          </button>
          <button className="outline-button" type="button" onClick={onDownloadJson}>
            JSON
          </button>
        </div>
      </section>

      {vivaRecommended ? (
        <section className="panel">
          <h2>
            <FileQuestion size={18} />
            Viva options
          </h2>
          <details className="viva-details">
            <summary>
              Suggested viva questions
              <span>{report.vivaQuestions.length} generated</span>
            </summary>
            <div className="question-list">
              {report.vivaQuestions.map((question, index) => (
                <div className="question" key={`${question.question}-${index}`}>
                  <strong>{index + 1}. {question.question}</strong>
                  <p>{question.rationale}</p>
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : (
        <section className="panel">
          <h2>
            <FileQuestion size={18} />
            Viva options
          </h2>
          <p className="muted">
            {judgementReady
              ? "Viva questions are not generated because the current judgement does not recommend a viva."
              : "Viva questions will only appear if the completed judgement recommends a viva."}
          </p>
        </section>
      )}
    </div>
  );
}

export function ReasoningBlock({
  body,
  icon,
  title
}: {
  body: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="panel reasoning-panel">
      <h2>
        {icon}
        {title}
      </h2>
      <p>{body}</p>
    </section>
  );
}

export function FindingCard({ finding }: { finding: LaisrReport["findings"][number] }) {
  return (
    <article className={`finding ${finding.severity}`}>
      <div className="finding-head">
        <span>{severityLabel(finding.severity)}</span>
        <strong>{finding.title}</strong>
      </div>
      <p className="specific-summary">
        <strong>What LAISR found in this file:</strong> {plainFindingObservation(finding)}
      </p>
      <p className="plain-summary">
        <strong>Why this is being shown:</strong> {plainFindingSummary(finding)}
      </p>
      <details className="technical-evidence">
        <summary>Technical evidence</summary>
        <p>{finding.evidence}</p>
      </details>
      <dl>
        {finding.normalRange ? (
          <div>
            <dt>What this is compared with</dt>
            <dd>{finding.normalRange}</dd>
          </div>
        ) : null}
        <div>
          <dt>Why this may matter</dt>
          <dd>{finding.interpretation}</dd>
        </div>
        <div>
          <dt>Other possible explanations</dt>
          <dd>{finding.counterArgument}</dd>
        </div>
        <div>
          <dt>Useful viva follow-up</dt>
          <dd>{finding.vivaAngle}</dd>
        </div>
      </dl>
    </article>
  );
}

export function LinguisticMap({ report }: { report: LaisrReport }) {
  const segments = report.linguisticProfile.segments;

  if (segments.length === 0) {
    return <p>No long-enough text segments were available for complexity mapping.</p>;
  }

  return (
    <div className="linguistic-map">
      <div className="map-head">
        <span>Complexity, formal-register, and passive-voice map</span>
        <small>{report.linguisticProfile.consistencyScore}/100 - {report.linguisticProfile.consistencyLabel}</small>
      </div>
      <div className="segment-grid">
        {segments.map((segment) => (
          <div
            className={`segment-cell complexity-${segment.complexityBand} register-${segment.registerBand} passive-${segment.passiveBand}`}
            key={segment.index}
            title={`Segment ${segment.index + 1}: FK grade ${segment.fkGrade.toFixed(1)}, Fog ${segment.fogIndex.toFixed(1)}, formal density ${segment.formalDensity.toFixed(1)} per 100 words, passive density ${segment.passiveDensity.toFixed(1)} per sentence`}
          >
            {segment.index + 1}
          </div>
        ))}
      </div>
      <div className="map-legend">
        <span><i className="legend low" />Lower complexity</span>
        <span><i className="legend normal" />Typical range</span>
        <span><i className="legend high" />Higher complexity</span>
        <span><i className="legend register" />Formal wording spike</span>
        <span><i className="legend passive" />Passive voice spike</span>
      </div>
    </div>
  );
}

export function ComparativePanel({ report }: { report: LaisrReport }) {
  const profile = report.comparativeProfile;

  if (!profile.available) {
    return (
      <div className="compare-panel empty">
        <strong>No authenticated sample supplied</strong>
        <p>Upload a known piece of the candidate&apos;s writing to compare style, sentence length, vocabulary range, and register against the submitted document.</p>
      </div>
    );
  }

  return (
    <div className="compare-panel">
      <div className="compare-score">
        <strong>{profile.score}/100</strong>
        <span>{profile.label}</span>
        <small>Compared with {profile.sampleFileName}</small>
      </div>
      <div className="compare-bars">
        {profile.metrics.map((metric) => (
          <div className={`compare-metric ${metric.severity}`} key={metric.label}>
            <div>
              <strong>{metric.label}</strong>
              <span>Submitted {metric.submitted.toFixed(2)} / Sample {metric.authenticated.toFixed(2)}</span>
            </div>
            <i style={{ width: `${Math.min(100, Math.max(4, metric.difference * 12))}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
