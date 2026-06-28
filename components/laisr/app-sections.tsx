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
import type { AiReviewPlan } from "./use-laisr-review";
import {
  OutcomeScale,
  SummaryItem
} from "./ui-primitives";
export function HomeOptions({ onSingleUpload }: { onSingleUpload: () => void }) {
  return (
    <section className="teacher-home">
      <div className="teacher-hero">
        <div>
          <p className="eyebrow">Academic integrity triage</p>
          <h1>Decide who needs a viva, with evidence you can explain.</h1>
          <p>
            LAISR checks a submitted Word document, summarises the strongest concerns in plain language, and prepares
            follow-up questions that help a candidate demonstrate authorship.
          </p>
          <button className="primary-button large-action" type="button" onClick={onSingleUpload}>
            <FileSearch size={19} />
            Analyse a submission
          </button>
        </div>
        <div className="teacher-hero-panel" aria-label="Review flow">
          <span>1. Upload</span>
          <span>2. Analyse</span>
          <span>3. Review concerns</span>
          <span>4. Prepare viva</span>
        </div>
      </div>

      <div className="future-actions" aria-label="Future tools">
        <div>
          <Files size={20} />
          <span>
            <strong>Class set review</strong>
            <small>Batch review is planned later.</small>
          </span>
        </div>
        <div>
          <Clock size={20} />
          <span>
            <strong>Saved reports</strong>
            <small>Report history will come with storage.</small>
          </span>
        </div>
      </div>
    </section>
  );
}

export function SingleUploadScreen({
  aiConfigured,
  aiLoading,
  aiReviewPlan,
  analysisStage,
  authenticatedFile,
  candidateId,
  error,
  file,
  loading,
  subject,
  onAnalyse,
  onAuthenticatedFileChange,
  onAiReviewPlanChange,
  onBack,
  onCandidateIdChange,
  onFileChange,
  onSubjectChange
}: {
  aiConfigured: boolean;
  aiLoading: boolean;
  aiReviewPlan: AiReviewPlan;
  analysisStage:
    | "idle"
    | "upload_ready"
    | "running_file_checks"
    | "running_ai_text_review"
    | "running_final_synthesis"
    | "complete"
    | "partial_no_ai"
    | "failed";
  authenticatedFile: File | null;
  candidateId: string;
  error: string;
  file: File | null;
  loading: boolean;
  subject: string;
  onAnalyse: () => void;
  onAuthenticatedFileChange: (file: File | null) => void;
  onAiReviewPlanChange: (reviewId: keyof AiReviewPlan, enabled: boolean) => void;
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
          <h1>Analyse a submission</h1>
          <p>Choose the submitted Word file. Add known student writing if you want LAISR to compare style.</p>
        </div>
      </div>

      <div className="upload-workspace">
        <div className="upload-stack">
          <label className="upload-zone">
            <Upload size={30} />
            <strong>{file ? file.name : "Choose DOCX submission"}</strong>
            <span>LAISR checks file history, writing patterns, document text, and source-use signals.</span>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="upload-zone compact">
            <FileText size={24} />
            <strong>{authenticatedFile ? authenticatedFile.name : "Optional known writing sample"}</strong>
            <span>Use this if you have earlier work you trust came from the same student.</span>
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

          <div className="ai-plan-panel" aria-label="AI review options">
            <div>
              <strong>AI review options</strong>
              <span>
                {aiConfigured
                  ? "Choose which AI opinions to add after the file checks."
                  : "AI options are unavailable until an OpenAI key is configured."}
              </span>
            </div>
            <AiPlanToggle
              checked={aiReviewPlan.ai_prose}
              disabled={!aiConfigured}
              label="AI reads the essay text"
              help="The model sees the visible essay text only and comments on possible copying, close paraphrase, AI-written passages, or inconsistent authorship."
              onChange={(checked) => onAiReviewPlanChange("ai_prose", checked)}
            />
            <AiPlanToggle
              checked={aiReviewPlan.metadata}
              disabled={!aiConfigured}
              label="AI explains file-history clues"
              help="The model sees only the file-history findings and turns them into a plain-language opinion."
              onChange={(checked) => onAiReviewPlanChange("metadata", checked)}
            />
            <AiPlanToggle
              checked={aiReviewPlan.textual}
              disabled={!aiConfigured}
              label="AI explains writing-pattern clues"
              help="The model sees only the writing-pattern findings, such as odd word choices, repetition, and complexity shifts."
              onChange={(checked) => onAiReviewPlanChange("textual", checked)}
            />
            <AiPlanToggle
              checked={aiReviewPlan.comparative}
              disabled={!aiConfigured || !authenticatedFile}
              label="AI compares known writing"
              help="Available when you add a known writing sample. The model compares the comparison results, not the raw file history."
              onChange={(checked) => onAiReviewPlanChange("comparative", checked)}
            />
            <AiPlanToggle
              checked={aiReviewPlan.finalSynthesis}
              disabled={!aiConfigured}
              label="AI helps with the final weighing"
              help="The model weighs the completed findings and selected AI opinions into a teacher-facing viva recommendation."
              onChange={(checked) => onAiReviewPlanChange("finalSynthesis", checked)}
            />
          </div>

          <button className="primary-button" type="button" disabled={loading} onClick={onAnalyse}>
            {loading ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
            {loading ? "Analysing" : "Start review"}
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

function AiPlanToggle({
  checked,
  disabled,
  help,
  label,
  onChange
}: {
  checked: boolean;
  disabled: boolean;
  help: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ai-plan-toggle">
      <input
        checked={checked && !disabled}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
    </label>
  );
}

type TeacherAnalysisState =
  | "idle"
  | "upload_ready"
  | "running_file_checks"
  | "running_ai_text_review"
  | "running_final_synthesis"
  | "complete"
  | "partial_no_ai"
  | "failed";

export function AnalysisProgressScreen({
  aiConfigured,
  aiReviewPlan,
  error,
  fileName,
  stage
}: {
  aiConfigured: boolean;
  aiReviewPlan: AiReviewPlan;
  error: string;
  fileName?: string;
  stage: TeacherAnalysisState;
}) {
  const selectedSectionAiCount = (["metadata", "textual", "comparative", "ai_prose"] as const)
    .filter((sectionId) => aiReviewPlan[sectionId]).length;
  const steps = [
    {
      id: "file",
      label: "Checking the Word file",
      description: "Reading the document, file history, formatting traces, and visible text.",
      active: stage === "running_file_checks",
      complete: stage === "running_ai_text_review" || stage === "running_final_synthesis" || stage === "complete" || stage === "partial_no_ai"
    },
    {
      id: "ai",
      label: aiConfigured
        ? selectedSectionAiCount
          ? `Running ${selectedSectionAiCount} selected AI review${selectedSectionAiCount === 1 ? "" : "s"}`
          : "No section AI reviews selected"
        : "AI review unavailable",
      description: aiConfigured
        ? selectedSectionAiCount
          ? "Selected AI opinions run after the file checks and use only their assigned evidence."
          : "LAISR will move straight from file checks to final weighing."
        : "No OpenAI key is configured, so LAISR will use file checks only.",
      active: stage === "running_ai_text_review",
      complete: stage === "running_final_synthesis" || stage === "complete",
      skipped: !aiConfigured || selectedSectionAiCount === 0 || stage === "partial_no_ai"
    },
    {
      id: "summary",
      label: aiReviewPlan.finalSynthesis && aiConfigured ? "AI is helping with final weighing" : "Preparing the viva recommendation",
      description: aiReviewPlan.finalSynthesis && aiConfigured
        ? "The model weighs the completed evidence streams into a teacher-facing triage outcome."
        : "LAISR is using the completed scores to create a teacher-facing triage outcome.",
      active: stage === "running_final_synthesis",
      complete: stage === "complete" || stage === "partial_no_ai"
    }
  ];

  return (
    <section className="analysis-stage-screen" aria-live="polite">
      <div className="analysis-stage-card">
        <div className="stage-loader">
          {stage === "failed" ? <AlertTriangle size={28} /> : <Loader2 className="spin" size={28} />}
        </div>
        <p className="eyebrow">Analyse</p>
        <h1>{stage === "failed" ? "Review could not be completed" : "LAISR is reviewing the submission"}</h1>
        <p>
          {fileName ? <strong>{fileName}</strong> : "Your document"} is being checked. The final recommendation will
          appear only after the selected evidence steps have finished.
        </p>
        <div className="teacher-progress-list">
          {steps.map((step) => (
            <div
              className={
                step.active
                  ? "teacher-progress-step active"
                  : step.complete
                    ? "teacher-progress-step complete"
                    : step.skipped
                      ? "teacher-progress-step skipped"
                      : "teacher-progress-step"
              }
              key={step.id}
            >
              <span>
                {step.active ? <Loader2 className="spin" size={15} /> : step.complete ? <CheckCircle2 size={15} /> : step.skipped ? "-" : ""}
              </span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </div>
            </div>
          ))}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}

export function TeacherReviewDashboard({
  aiConfigured,
  analysisStage,
  finalRecommendation,
  includeVivaInPdf,
  onDownloadJson,
  onDownloadPdf,
  onReset,
  onToggleViva,
  pdfLoading,
  report,
  sectionAiReviews
}: {
  aiConfigured: boolean;
  analysisStage: TeacherAnalysisState;
  finalRecommendation: FinalRecommendation | null;
  includeVivaInPdf: boolean;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
  onReset: () => void;
  onToggleViva: (value: boolean) => void;
  pdfLoading: boolean;
  report: LaisrReport;
  sectionAiReviews: Partial<Record<ReviewSectionId, SectionAiReview>>;
}) {
  const groups = buildTeacherConcernGroups(report, sectionAiReviews, aiConfigured);
  const vivaRecommended =
    finalRecommendation?.recommendation === "Viva recommended" ||
    finalRecommendation?.recommendation === "Strong viva recommended";

  return (
    <section className="teacher-review">
      <ReviewStatusHeader
        aiConfigured={aiConfigured}
        analysisStage={analysisStage}
        finalRecommendation={finalRecommendation}
        report={report}
      />

      <section className={`teacher-outcome ${finalRecommendation ? recommendationTone(finalRecommendation.recommendation) : "pending"}`}>
        <div>
          <p className="eyebrow">Recommendation</p>
          <h1>{finalRecommendation ? directRecommendationLabel(finalRecommendation.recommendation) : "Recommendation pending"}</h1>
          {finalRecommendation ? (
            <TeacherRationale text={finalRecommendation.rationale} />
          ) : (
            <p>LAISR has not produced a final viva recommendation yet.</p>
          )}
        </div>
        <div className="outcome-score">
          <span>{finalRecommendation?.concernScore ?? "-"}</span>
          <small>concern / 10</small>
        </div>
      </section>

      <section className="review-split">
        <aside className="review-left-rail" aria-label="Evidence navigation">
          <div className="review-left-heading">
            <div>
              <p className="eyebrow">Review concerns</p>
              <h2>What LAISR found</h2>
            </div>
            <button className="outline-button compact-action" type="button" onClick={onReset}>
              New review
            </button>
          </div>
          <div className="concern-accordion">
            {groups.map((group, index) => (
              <ConcernGroupCard group={group} index={index + 1} key={group.id} />
            ))}
          </div>
        </aside>

        <section className="review-document-panel" aria-label="Document review">
          <FileSnapshotCard report={report} />
          <DocumentAnnotationView report={report} showAnnotations={false} />
        </section>
      </section>

      <section className="teacher-section export-section">
        <div>
          <p className="eyebrow">Prepare viva / export report</p>
          <h2>{vivaRecommended ? "Suggested viva questions" : "Report export"}</h2>
          <p>
            {vivaRecommended
              ? "Use these questions to test authorship, understanding, process, and source handling."
              : "A viva is not currently indicated, but you can still export the review record."}
          </p>
        </div>

        {vivaRecommended ? (
          <div className="teacher-question-list">
            {report.vivaQuestions.slice(0, 8).map((question, index) => (
              <article className="teacher-question" key={`${question.question}-${index}`}>
                <strong>{index + 1}. {question.question}</strong>
                <p>{question.rationale}</p>
              </article>
            ))}
          </div>
        ) : null}

        <div className="teacher-export-actions">
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
          <button className="primary-button" type="button" disabled={pdfLoading || !finalRecommendation} onClick={onDownloadPdf}>
            {pdfLoading ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
            Download PDF report
          </button>
          <button className="outline-button" type="button" onClick={onDownloadJson}>
            Export JSON
          </button>
        </div>
      </section>
    </section>
  );
}

type TeacherConcernGroup = {
  id: string;
  title: string;
  description: string;
  status: "clear" | "check" | "concern" | "high";
  statusLabel: "Clear" | "Check" | "Concern" | "High concern";
  findings: LaisrReport["findings"];
  technicalChecks: string[];
  aiReview?: SectionAiReview;
  emptyText: string;
};

function FileSnapshotCard({ report }: { report: LaisrReport }) {
  const rootId = findRootEditId(report);
  const revision = report.metadata.revision && report.metadata.revision !== "N/A"
    ? report.metadata.revision
    : "Not recorded";

  return (
    <article className="file-snapshot-card" id="file-snapshot">
      <div>
        <p className="eyebrow">File history snapshot</p>
        <h2>{report.summary.fileName}</h2>
        <p>
          These are the key Word file-history details. They help explain global metadata and file-structure findings
          that do not attach to one visible paragraph.
        </p>
      </div>
      <div className="file-snapshot-grid">
        <SummaryItem label="Candidate" value={report.summary.candidateId || "Not supplied"} />
        <SummaryItem label="Subject" value={report.summary.subject || "Not supplied"} />
        <SummaryItem label="Author" value={report.metadata.creator || "Not recorded"} />
        <SummaryItem label="Last editor" value={report.metadata.lastModifiedBy || "Not recorded"} />
        <SummaryItem label="Revision count" value={revision} />
        <SummaryItem label="Root edit ID" value={rootId} />
        <SummaryItem label="Application" value={report.metadata.application || "Not recorded"} />
        <SummaryItem label="Words" value={String(report.summary.wordCount)} />
      </div>
    </article>
  );
}

function ReviewStatusHeader({
  aiConfigured,
  analysisStage,
  finalRecommendation,
  report
}: {
  aiConfigured: boolean;
  analysisStage: TeacherAnalysisState;
  finalRecommendation: FinalRecommendation | null;
  report: LaisrReport;
}) {
  const items = [
    { label: "Upload", detail: report.summary.fileName, status: "complete" },
    { label: "File checks", detail: `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`, status: "complete" },
    {
      label: "AI review",
      detail: aiConfigured ? (analysisStage === "complete" ? "Completed" : "Unavailable") : "Unavailable",
      status: aiConfigured && analysisStage === "complete" ? "complete" : "skipped"
    },
    {
      label: "Recommendation",
      detail: finalRecommendation ? directRecommendationLabel(finalRecommendation.recommendation) : "Pending",
      status: finalRecommendation ? "complete" : "current"
    }
  ];

  return (
    <section className="review-status-header" aria-label="Review status">
      {items.map((item) => (
        <div className={`review-status-item ${item.status}`} key={item.label}>
          <span>{item.status === "complete" ? <CheckCircle2 size={15} /> : item.status === "skipped" ? "-" : ""}</span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      ))}
    </section>
  );
}

function ConcernGroupCard({ group, index }: { group: TeacherConcernGroup; index: number }) {
  const findingGroups = groupFindingsForNavigation(group.findings);
  const previewFindings = [...group.findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 3);

  return (
    <details className={`concern-card status-${group.status}`}>
      <summary className="concern-card-summary">
        <span className="concern-number">{index}</span>
        <div>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <mark>{group.statusLabel}</mark>
      </summary>
      <div className="concern-card-head">
        <div>
          <strong>Quick read</strong>
          <p>{group.findings.length ? `${group.findings.length} item${group.findings.length === 1 ? "" : "s"} to review.` : group.emptyText}</p>
        </div>
      </div>

      {group.aiReview ? (
        <div className={`teacher-ai-opinion concern-${group.aiReview.concern}`}>
          <strong>AI concern: {aiConcernLabel(group.aiReview.concern)} - {group.aiReview.concernScore}/10</strong>
          <p>{group.aiReview.summary || summariseAiOpinion(group.aiReview.opinion)}</p>
          <details>
            <summary>Read full AI review</summary>
            <p>{group.aiReview.opinion}</p>
          </details>
        </div>
      ) : null}

      {group.findings.length > 0 ? (
        <>
          <div className="finding-preview-list">
            {previewFindings.map((finding) => (
              <a className="finding-preview-row" href={findingJumpHref(finding)} key={finding.id}>
                <span className={`severity-dot ${finding.severity}`}>{severityLabel(finding.severity)}</span>
                <strong>{plainFindingObservation(finding)}</strong>
                <small>{findingLocationLabel(finding)}</small>
              </a>
            ))}
          </div>
          <div className="finding-group-stack">
            {findingGroups.map((findingGroup) => (
              <details className="group-detail-drawer" key={findingGroup.label}>
                <summary>
                  {findingGroup.label} <span>{findingGroup.findings.length}</span>
                </summary>
                <div className="teacher-finding-list">
                  {findingGroup.findings.map((finding) => (
                    <TeacherFindingCard finding={finding} key={finding.id} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">{group.emptyText}</p>
      )}

      <details className="technical-evidence">
        <summary>What was checked?</summary>
        <ul>
          {group.technicalChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </details>
    </details>
  );
}

function TeacherFindingCard({ finding }: { finding: LaisrReport["findings"][number] }) {
  const range = getFindingParagraphRange(finding, 9999);

  return (
    <details className={`teacher-finding ${finding.severity}`} id={`finding-${finding.id}`}>
      <summary className="teacher-finding-summary">
        <div className="teacher-finding-title">
          <span>{severityLabel(finding.severity)}</span>
          <strong>{finding.title}</strong>
        </div>
        <p>{plainFindingObservation(finding)}</p>
      </summary>
      <dl>
        <div>
          <dt>Why it may matter</dt>
          <dd>{plainFindingSummary(finding)}</dd>
        </div>
        <div>
          <dt>What else could explain it</dt>
          <dd>{finding.counterArgument}</dd>
        </div>
        <div>
          <dt>What to ask in viva</dt>
          <dd>{finding.vivaAngle}</dd>
        </div>
        <div>
          <dt>Deeper detail</dt>
          <dd>{finding.evidence}</dd>
        </div>
      </dl>
      <a href={range ? `#paragraph-${range.start}` : "#file-snapshot"}>
        {range ? `View paragraph ${range.start}` : "View file snapshot"}
      </a>
    </details>
  );
}

function buildTeacherConcernGroups(
  report: LaisrReport,
  sectionAiReviews: Partial<Record<ReviewSectionId, SectionAiReview>>,
  aiConfigured: boolean
): TeacherConcernGroup[] {
  const fileFindings = report.findings.filter((finding) =>
    ["Document Metadata", "Package Forensics", "XML Forensics", "Relationships and Embedded Objects"].includes(finding.category)
  );
  const writingFindings = report.findings.filter((finding) =>
    ["Textual Anomalies", "Stylometric Indicators", "Linguistic Consistency"].includes(finding.category)
  );
  const comparisonFindings = report.findings.filter((finding) => finding.category === "Authenticated Writing Comparison");
  const fileStatus = combinedConcernStatus(fileFindings, sectionAiReviews.metadata);
  const writingStatus = combinedConcernStatus(writingFindings, sectionAiReviews.textual);
  const comparisonStatus = report.comparativeProfile.available
    ? combinedConcernStatus(comparisonFindings, sectionAiReviews.comparative)
    : "clear";
  const proseStatus = statusFromAiReview(sectionAiReviews.ai_prose);

  return [
    {
      id: "file",
      title: "How the file was made",
      description: "Checks whether the Word file shows unusual editing, pasting, formatting, hidden text, or embedded-content clues.",
      status: fileStatus,
      statusLabel: concernStatusText(fileStatus),
      findings: fileFindings,
      aiReview: sectionAiReviews.metadata,
      technicalChecks: ["Document properties", "file package timestamps", "edit-session markers", "hidden text", "browser paste traces", "embedded objects"],
      emptyText: "No notable file-history concerns were found."
    },
    {
      id: "writing",
      title: "How the writing behaves",
      description: "Checks whether sections of the essay look unusually repetitive, inconsistent, heavily smoothed, or visibly patched together.",
      status: writingStatus,
      statusLabel: concernStatusText(writingStatus),
      findings: writingFindings,
      aiReview: sectionAiReviews.textual,
      technicalChecks: ["odd substitutions", "merged words", "repeated paragraphs", "sentence patterns", "complexity shifts", "formal wording spikes"],
      emptyText: "No notable writing-pattern concerns were found."
    },
    {
      id: "comparison",
      title: "How it compares with known work",
      description: report.comparativeProfile.available
        ? "Compares this submission with the known student writing sample you supplied."
        : "No known writing sample was supplied, so this comparison was not run.",
      status: comparisonStatus,
      statusLabel: concernStatusText(comparisonStatus),
      findings: comparisonFindings,
      aiReview: sectionAiReviews.comparative,
      technicalChecks: ["sentence length", "word length", "type-token ratio", "formal wording", "passive voice", "transition density"],
      emptyText: report.comparativeProfile.available
        ? "The submitted writing was broadly consistent with the known sample."
        : "Known writing comparison was not supplied."
    },
    {
      id: "ai",
      title: "What AI thinks from the text alone",
      description: aiConfigured
        ? "AI reviewed only the essay text for source-use, authorship, paraphrasing, and AI-writing indicators."
        : "AI review was unavailable because no OpenAI key is configured.",
      status: proseStatus,
      statusLabel: concernStatusText(proseStatus),
      findings: [],
      aiReview: sectionAiReviews.ai_prose,
      technicalChecks: ["visible essay text only", "source-use indicators", "close paraphrase indicators", "AI-assisted writing indicators", "authorship consistency"],
      emptyText: aiConfigured
        ? "AI did not return a completed text-only concern."
        : "AI review was not run."
    }
  ];
}

function concernStatus(findings: LaisrReport["findings"]): TeacherConcernGroup["status"] {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "high";
  }

  if (findings.some((finding) => finding.severity === "serious") || findings.filter((finding) => finding.severity === "notable").length >= 3) {
    return "concern";
  }

  if (findings.some((finding) => finding.severity === "notable" || finding.severity === "info")) {
    return "check";
  }

  return "clear";
}

function groupFindingsForNavigation(findings: LaisrReport["findings"]) {
  const groups = new Map<string, LaisrReport["findings"]>();

  for (const finding of findings) {
    const label = findingGroupLabel(finding);
    groups.set(label, [...(groups.get(label) || []), finding]);
  }

  return [...groups.entries()].map(([label, groupedFindings]) => ({
    label,
    findings: groupedFindings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  }));
}

function findingGroupLabel(finding: LaisrReport["findings"][number]) {
  if (finding.id.startsWith("text-sub-")) {
    return "Suspicious word substitutions";
  }

  if (finding.id.startsWith("text-merge-") || finding.id.startsWith("text-compound-")) {
    return "Merged compound words";
  }

  if (finding.id.startsWith("text-grammar-") || finding.id === "text-studies-is") {
    return "Grammar or phrasing slips";
  }

  if (finding.id.startsWith("style-near-dup-") || finding.id === "style-transitions" || finding.id === "style-openers") {
    return "Repeated or patterned writing";
  }

  if (finding.id.startsWith("ling-")) {
    return "Complexity and style shifts";
  }

  if (finding.id.startsWith("compare-")) {
    return "Differences from known writing";
  }

  if (finding.id.startsWith("metadata-")) {
    return "Document property clues";
  }

  if (finding.id.startsWith("xml-rsid") || finding.id.includes("rsid")) {
    return "Edit history clues";
  }

  if (finding.id.includes("browser") || finding.id.includes("hidden") || finding.id.includes("white")) {
    return "Hidden or pasted-formatting clues";
  }

  if (finding.category === "Relationships and Embedded Objects") {
    return "Links, embedded objects, and templates";
  }

  if (finding.category === "Package Forensics") {
    return "Save/export clues";
  }

  return "Other findings";
}

function findingJumpHref(finding: LaisrReport["findings"][number]) {
  const range = getFindingParagraphRange(finding, 9999);
  return range ? `#paragraph-${range.start}` : "#file-snapshot";
}

function findingLocationLabel(finding: LaisrReport["findings"][number]) {
  const range = getFindingParagraphRange(finding, 9999);

  if (!range) {
    return "File snapshot";
  }

  return range.start === range.end ? `Paragraph ${range.start}` : `Paragraphs ${range.start}-${range.end}`;
}

function findRootEditId(report: LaisrReport) {
  const rootFinding = report.findings.find((finding) => finding.id === "xml-rsid-root");
  const quotedValue = rootFinding?.evidence.match(/"([^"]+)"/)?.[1];

  return quotedValue || "Not recorded";
}

function summariseAiOpinion(opinion: string) {
  const firstSentence = opinion.trim().split(/(?<=[.!?])\s+/)[0] || opinion.trim();
  return firstSentence.length > 150 ? `${firstSentence.slice(0, 147)}...` : firstSentence;
}

function combinedConcernStatus(
  findings: LaisrReport["findings"],
  aiReview?: SectionAiReview
): TeacherConcernGroup["status"] {
  const algorithmicStatus = concernStatus(findings);
  const aiStatusValue = statusFromAiReview(aiReview);

  return statusRank(aiStatusValue) > statusRank(algorithmicStatus) ? aiStatusValue : algorithmicStatus;
}

function statusFromAiReview(aiReview?: SectionAiReview): TeacherConcernGroup["status"] {
  if (aiReview?.status !== "completed") {
    return "clear";
  }

  if (aiReview.concern === "high") {
    return "high";
  }

  if (aiReview.concern === "moderate") {
    return "concern";
  }

  if (aiReview.concern === "low") {
    return "check";
  }

  return "clear";
}

function concernStatusText(status: TeacherConcernGroup["status"]): TeacherConcernGroup["statusLabel"] {
  return status === "high" ? "High concern" : status === "concern" ? "Concern" : status === "check" ? "Check" : "Clear";
}

function statusRank(status: TeacherConcernGroup["status"]) {
  return {
    clear: 0,
    check: 1,
    concern: 2,
    high: 3
  }[status];
}

function severityRank(severity: LaisrReport["findings"][number]["severity"]) {
  if (severity === "critical") {
    return 4;
  }

  if (severity === "serious") {
    return 3;
  }

  if (severity === "notable") {
    return 2;
  }

  return 1;
}

function TeacherRationale({ text }: { text: string }) {
  const sections = parseTeacherRationale(text);

  return (
    <div className="teacher-rationale">
      {sections.map((section) => (
        <section className="teacher-rationale-section" key={section.title}>
          <strong>{section.title}</strong>
          <ul>
            {section.bullets.map((bullet, index) => (
              <li key={`${section.title}-${index}`}>{bullet}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function parseTeacherRationale(text: string) {
  const labels = ["Bottom line", "Main reasons", "Other explanations", "Viva focus"];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections: Array<{ title: string; bullets: string[] }> = [];
  let current: { title: string; bullets: string[] } | null = null;

  for (const line of lines) {
    const label = labels.find((item) => line.replace(/:$/, "").toLowerCase() === item.toLowerCase());

    if (label) {
      current = { title: label, bullets: [] };
      sections.push(current);
      continue;
    }

    if (current) {
      current.bullets.push(cleanRationaleBullet(line));
    }
  }

  const labelledSections = sections
    .map((section) => ({ ...section, bullets: section.bullets.filter(Boolean).slice(0, 3) }))
    .filter((section) => section.bullets.length);

  return labelledSections.length ? labelledSections : fallbackTeacherRationale(text);
}

function fallbackTeacherRationale(text: string) {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const vivaSentences = sentences.filter((sentence) => /viva|ask|draft|notes|version|question|explain/i.test(sentence));
  const explanationSentences = sentences.filter((sentence) => /however|but|can|could|common|explanation|innocent|normal/i.test(sentence));
  const reasonSentences = sentences
    .filter((sentence) => !vivaSentences.includes(sentence) && !explanationSentences.includes(sentence))
    .slice(0, 2);

  return [
    {
      title: "Bottom line",
      bullets: [vivaSentences[0] || sentences[0] || "Review the evidence before deciding next steps."]
    },
    {
      title: "Main reasons",
      bullets: reasonSentences.length ? reasonSentences : sentences.slice(0, 2)
    },
    {
      title: "Other explanations",
      bullets: explanationSentences.slice(0, 2)
    },
    {
      title: "Viva focus",
      bullets: vivaSentences.slice(0, 2)
    }
  ].filter((section) => section.bullets.length);
}

function cleanRationaleBullet(line: string) {
  return line.replace(/^[-*•]\s*/, "").trim();
}

function directRecommendationLabel(recommendation: FinalRecommendation["recommendation"]) {
  if (recommendation === "No significant indicators detected") {
    return "No viva indicated";
  }

  if (recommendation === "Examiner review recommended") {
    return "Teacher review suggested";
  }

  if (recommendation === "Strong viva recommended") {
    return "Strong viva recommendation";
  }

  return "Viva recommended";
}

function recommendationTone(recommendation: FinalRecommendation["recommendation"]) {
  if (recommendation === "Strong viva recommended") {
    return "high";
  }

  if (recommendation === "Viva recommended") {
    return "concern";
  }

  if (recommendation === "Examiner review recommended") {
    return "check";
  }

  return "clear";
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
        <TeacherRationale text={finalRecommendation.rationale} />
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
  stage: TeacherAnalysisState;
}) {
  const steps = [
    "Load DOCX",
    "File history",
    "Writing patterns",
    ...(hasAuthenticatedSample ? ["Compare sample"] : []),
    "AI text opinion",
    "Viva recommendation"
  ];
  const activeIndex =
    stage === "running_file_checks"
      ? hasAuthenticatedSample ? 3 : 2
      : stage === "running_ai_text_review"
        ? steps.length - 2
        : stage === "running_final_synthesis"
          ? steps.length - 1
          : stage === "complete" || stage === "partial_no_ai"
          ? steps.length - 1
          : 0;

  return (
    <div className="progress-rail">
      {steps.map((step, index) => (
        <div
          className={
            index < activeIndex || stage === "complete" || stage === "partial_no_ai"
              ? "progress-step done"
              : index === activeIndex
                ? "progress-step active"
                : "progress-step"
          }
          key={step}
        >
          <span>{index < activeIndex || stage === "complete" || stage === "partial_no_ai" ? <CheckCircle2 size={13} /> : index + 1}</span>
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
  const aiButtonLabel = aiLoading
    ? "Reviewing"
    : aiReview?.status === "failed"
      ? "Retry AI"
      : aiReview?.status === "completed"
        ? "Rerun AI"
        : "Run AI";

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
          <span>{aiButtonLabel}</span>
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

export function DocumentReviewTab({ report }: { report: LaisrReport }) {
  return (
    <div className="findings-stack">
      <article className="panel evidence-overview">
        <div className="panel-heading-row">
          <div>
            <h2>
              <SearchCheck size={18} />
              Document review
            </h2>
            <p className="muted">
              Read the extracted text with linked annotations. File-level evidence appears separately because metadata,
              XML, and embedded-object signals do not always attach to a visible paragraph.
            </p>
          </div>
        </div>
        <DocumentAnnotationView report={report} />
      </article>
    </div>
  );
}

export function EvidenceOverviewTab({
  completedAiCount,
  onOpenTab,
  report,
  sectionAiLoading
}: {
  completedAiCount: number;
  onOpenTab: (tab: "document" | ReviewSectionId) => void;
  report: LaisrReport;
  sectionAiLoading: Partial<Record<ReviewSectionId, boolean>>;
}) {
  const rows: Array<{
    id: string;
    label: string;
    detail: string;
    status: "clear" | "issues" | "pending" | "not_run";
    target: "document" | ReviewSectionId;
  }> = [
    {
      id: "document",
      label: "Document review",
      detail: `${report.summary.paragraphCount} paragraphs extracted with linked annotations where possible.`,
      status: report.findings.length > 0 ? "issues" : "clear",
      target: "document"
    },
    ...report.evidenceChecks.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.summary,
      status: check.status,
      target: evidenceCheckTarget(check.category)
    })),
    {
      id: "section-ai",
      label: "Scoped AI reviews",
      detail: completedAiCount
        ? `${completedAiCount} AI section opinion${completedAiCount === 1 ? "" : "s"} completed.`
        : "Optional section-specific AI opinions have not been run.",
      status: Object.values(sectionAiLoading).some(Boolean)
        ? "pending"
        : completedAiCount > 0
          ? "issues"
          : "not_run",
      target: "ai_prose"
    }
  ];

  return (
    <section className="panel evidence-overview">
      <div className="panel-heading-row">
        <div>
          <h2>
            <SearchCheck size={18} />
            Evidence overview
          </h2>
          <p className="muted">
            Use this as the control room for the review. Each row shows whether an area was checked and opens the
            most relevant workspace.
          </p>
        </div>
      </div>
      <div className="evidence-overview-list">
        {rows.map((row) => (
          <button className="overview-row" key={row.id} type="button" onClick={() => onOpenTab(row.target)}>
            <span>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </span>
            <mark className={`tag ${row.status}`}>
              {row.status === "issues"
                ? "Review"
                : row.status === "pending"
                  ? "Running"
                  : row.status === "not_run"
                    ? "Not run"
                    : "Clear"}
            </mark>
          </button>
        ))}
      </div>
    </section>
  );
}

function evidenceCheckTarget(category: string): ReviewSectionId {
  if (category === "Authenticated Writing Comparison") {
    return "comparative";
  }

  if (category === "Textual Anomalies" || category === "Stylometric Indicators" || category === "Linguistic Consistency") {
    return "textual";
  }

  if (category === "AI Text Review" || category === "Text-only AI Prose Opinion") {
    return "ai_prose";
  }

  return "metadata";
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
  report,
  showAnnotations = true
}: {
  findings?: LaisrReport["findings"];
  report: LaisrReport;
  showAnnotations?: boolean;
}) {
  const paragraphs = report.extractedTextPreview
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const scopedFindings = findings || report.findings;
  const paragraphAnnotations = scopedFindings.filter((finding) => getFindingParagraphRange(finding, paragraphs.length));
  const fileAnnotations = scopedFindings.filter((finding) => !getFindingParagraphRange(finding, paragraphs.length));

  return (
    <div className={showAnnotations ? "annotation-layout" : "annotation-layout document-only"}>
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

      {showAnnotations ? (
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
      ) : null}
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
