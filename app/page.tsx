"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  FileQuestion,
  FileSearch,
  Files,
  FileText,
  Loader2,
  SearchCheck,
  ShieldCheck,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LaisrReport, Severity } from "@/lib/laisr/types";

type ReportTab = "evidence" | "interpretation" | "counter" | "judgement";
type AppView = "home" | "single";

export default function Home() {
  const [view, setView] = useState<AppView>("home");
  const [file, setFile] = useState<File | null>(null);
  const [authenticatedFile, setAuthenticatedFile] = useState<File | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [subject, setSubject] = useState("");
  const [report, setReport] = useState<LaisrReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("evidence");
  const [includeVivaInPdf, setIncludeVivaInPdf] = useState(true);
  const [analysisStage, setAnalysisStage] = useState<"idle" | "deterministic" | "ai" | "complete">("idle");
  const [aiConfig, setAiConfig] = useState<{
    aiConfigured: boolean;
    model: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/config")
      .then((response) => response.json())
      .then((payload) => {
        if (active) {
          setAiConfig(payload);
        }
      })
      .catch(() => {
        if (active) {
          setAiConfig({ aiConfigured: false, model: "unknown" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function analyseDocument() {
    if (!file) {
      setError("Choose a .docx file first.");
      return;
    }

    setLoading(true);
    setAnalysisStage("deterministic");
    setError("");
    setReport(null);

    const formData = new FormData();
    formData.append("file", file);
    if (authenticatedFile) {
      formData.append("authenticatedFile", authenticatedFile);
    }
    formData.append("candidateId", candidateId);
    formData.append("subject", subject);

    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      setReport(payload);
      setActiveTab("evidence");
      setLoading(false);

      if (aiConfig?.aiConfigured !== false) {
        await enrichWithAi(file, candidateId, subject);
      } else {
        setAnalysisStage("complete");
      }
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
      setAnalysisStage("idle");
    } finally {
      setLoading(false);
    }
  }

  async function enrichWithAi(selectedFile: File, selectedCandidateId: string, selectedSubject: string) {
    setAiLoading(true);
    setAnalysisStage("ai");

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (authenticatedFile) {
      formData.append("authenticatedFile", authenticatedFile);
    }
    formData.append("candidateId", selectedCandidateId);
    formData.append("subject", selectedSubject);

    try {
      const response = await fetch("/api/analyse/ai", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI analysis failed.");
      }

      setReport(payload);
      setAnalysisStage("complete");
    } catch (aiError) {
      setReport((currentReport) =>
        currentReport
          ? {
              ...currentReport,
              aiReview: {
                enabled: true,
                status: "failed",
                evidenceConcern: "unavailable",
                evidenceOpinion: "AI evidence review failed while deterministic review remained available.",
                opinion: "AI analysis failed while deterministic review remained available.",
                counterArgument: "Do not treat absence of AI output as evidence either way.",
                assessment: aiError instanceof Error ? aiError.message : "AI analysis failed.",
                vivaQuestions: []
              },
              evidenceChecks: currentReport.evidenceChecks.map((check) =>
                check.id === "ai"
                  ? {
                      ...check,
                      status: "issues",
                      summary: "AI review failed",
                      detail: aiError instanceof Error ? aiError.message : "AI analysis failed."
                    }
                  : check
              )
            }
          : currentReport
      );
      setAnalysisStage("complete");
    } finally {
      setAiLoading(false);
    }
  }

  async function downloadPdf() {
    if (!report) {
      return;
    }

    setPdfLoading(true);
    setError("");

    try {
      const response = await fetch("/api/report/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          report,
          includeVivaQuestions: includeVivaInPdf
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "PDF generation failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.summary.fileName.replace(/\.docx$/i, "")}_laisr_report.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : "PDF generation failed.");
    } finally {
      setPdfLoading(false);
    }
  }

  function downloadJson() {
    if (!report) {
      return;
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.summary.fileName.replace(/\.docx$/i, "")}_laisr_report.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetReview() {
    setReport(null);
    setFile(null);
    setAuthenticatedFile(null);
    setCandidateId("");
    setSubject("");
    setError("");
    setAnalysisStage("idle");
    setActiveTab("evidence");
    setView("home");
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <strong>LAISR</strong>
            <span>Learning Authorship Integrity Signal Review</span>
          </div>
        </div>
        {view !== "home" || report ? (
          <button className="outline-button compact-action" type="button" onClick={resetReview}>
            <ArrowLeft size={16} />
            Home
          </button>
        ) : null}
      </header>

      {report ? (
        <section className="report">
          <div className={`recommendation ${finalJudgementReady(report) ? recommendationClass(report.summary.recommendation) : "pending"}`}>
            <div>
              <p className="eyebrow">
                <AlertTriangle size={16} />
                {finalJudgementReady(report) ? "Review recommendation" : "Evidence triage"}
              </p>
              <strong>
                {finalJudgementReady(report)
                  ? report.summary.recommendation
                  : "Final judgement pending AI review"}
              </strong>
              <span>
                {report.summary.seriousCount} serious/critical indicators{" - "}
                {report.summary.notableCount} notable indicators collected so far
              </span>
            </div>
          </div>

          <div className="summary-grid">
            <SummaryItem label="File" value={report.summary.fileName} />
            <SummaryItem label="Candidate" value={report.summary.candidateId} />
            <SummaryItem label="Words" value={String(report.summary.wordCount)} />
            <SummaryItem label="Paragraphs" value={String(report.summary.paragraphCount)} />
            <SummaryItem label="Consistency" value={`${report.linguisticProfile.consistencyScore}/100`} />
          </div>

          <section className="tab-shell">
            <div className="tabs" role="tablist" aria-label="LAISR report sections">
              <TabButton
                active={activeTab === "evidence"}
                icon={<FileSearch size={17} />}
                label="Evidence"
                onClick={() => setActiveTab("evidence")}
              />
              <TabButton
                active={activeTab === "interpretation"}
                icon={<Brain size={17} />}
                label="Interpretation"
                onClick={() => setActiveTab("interpretation")}
              />
              <TabButton
                active={activeTab === "counter"}
                icon={<Users size={17} />}
                label="Counter-Argument"
                onClick={() => setActiveTab("counter")}
              />
              <TabButton
                active={activeTab === "judgement"}
                icon={<CheckCircle2 size={17} />}
                label="Final Judgement"
                onClick={() => setActiveTab("judgement")}
              />
            </div>

            <div className="tab-panel">
              {activeTab === "evidence" ? (
                <EvidenceTab report={report} />
              ) : null}
              {activeTab === "interpretation" ? <InterpretationTab report={report} /> : null}
              {activeTab === "counter" ? <CounterArgumentTab report={report} /> : null}
              {activeTab === "judgement" ? (
                <JudgementTab
                  includeVivaInPdf={includeVivaInPdf}
                  onDownloadJson={downloadJson}
                  onDownloadPdf={downloadPdf}
                  onToggleViva={setIncludeVivaInPdf}
                  pdfLoading={pdfLoading}
                  report={report}
                />
              ) : null}
            </div>
          </section>
        </section>
      ) : (
        <>
          {view === "home" ? <HomeOptions onSingleUpload={() => setView("single")} /> : null}
          {view === "single" ? (
            <SingleUploadScreen
              aiLoading={aiLoading}
              analysisStage={analysisStage}
              authenticatedFile={authenticatedFile}
              candidateId={candidateId}
              error={error}
              file={file}
              loading={loading}
              subject={subject}
              onAnalyse={analyseDocument}
              onBack={() => setView("home")}
              onCandidateIdChange={setCandidateId}
              onFileChange={setFile}
              onAuthenticatedFileChange={setAuthenticatedFile}
              onSubjectChange={setSubject}
            />
          ) : null}
        </>
      )}
    </main>
  );
}

function HomeOptions({ onSingleUpload }: { onSingleUpload: () => void }) {
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

function SingleUploadScreen({
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
              AI is weighing the evidence before final judgement
            </div>
          ) : null}
          {analysisStage !== "idle" ? <ProgressRail stage={analysisStage} hasAuthenticatedSample={Boolean(authenticatedFile)} /> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={active ? "tab-button active" : "tab-button"}
      role="tab"
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressRail({
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
    "AI review",
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

function EvidenceTab({
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

function EvidenceChecklist({ report }: { report: LaisrReport }) {
  return (
    <div className="checklist">
      {report.evidenceChecks.map((check) => (
        <details className="check-row" key={check.id}>
          <summary>
            <span>
              <strong>{check.label}</strong>
              <small>{check.summary}</small>
            </span>
            <mark className={check.status === "issues" ? "tag issue" : "tag clear"}>
              {check.status === "issues" ? "Issues detected" : "Clear"}
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

function DocumentAnnotationView({ report }: { report: LaisrReport }) {
  const paragraphs = report.extractedTextPreview
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphAnnotations = report.findings.filter((finding) => getFindingParagraphRange(finding, paragraphs.length));
  const fileAnnotations = report.findings.filter((finding) => !getFindingParagraphRange(finding, paragraphs.length));

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

function AnnotationCard({
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

function InterpretationTab({ report }: { report: LaisrReport }) {
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
          AI Textual Review
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

function CounterArgumentTab({ report }: { report: LaisrReport }) {
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
        title="AI-generated counter-position"
      />
    </div>
  );
}

function JudgementTab({
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
        ? "The final judgement is not available because the AI review failed. The evidence remains available, but LAISR should not present an overall judgement until the AI weighing step completes."
        : report.aiReview.status === "not_configured"
          ? "The evidence has been gathered, but final judgement needs the AI weighing step. Add OPENAI_API_KEY to enable the final judgement stage."
          : "The evidence has been gathered. Final judgement will appear when the AI has reviewed the evidence, counter-position, and overall balance.";

  return (
    <div className="reasoning-stack">
      <section className="panel">
        <h2>
          <AlertTriangle size={18} />
          Outcome scale
        </h2>
        <div className="outcome-ladder">
          {OUTCOMES.map((outcome) => (
            <div
              className={
                judgementReady && outcome.label === report.summary.recommendation
                  ? `outcome-step active ${outcome.tone}`
                  : `outcome-step ${outcome.tone}`
              }
              key={outcome.label}
            >
              <span>{outcome.label}</span>
              <p>{outcome.description}</p>
            </div>
          ))}
        </div>
      </section>

      <ReasoningBlock
        body={judgementBody}
        icon={<CheckCircle2 size={18} />}
        title={judgementReady ? "Final AI-assisted judgement" : "Final judgement pending"}
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

const OUTCOMES: Array<{
  label: LaisrReport["summary"]["recommendation"];
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

function ReasoningBlock({
  body,
  icon,
  title
}: {
  body: string;
  icon: React.ReactNode;
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

function FindingCard({ finding }: { finding: LaisrReport["findings"][number] }) {
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

function LinguisticMap({ report }: { report: LaisrReport }) {
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

function ComparativePanel({ report }: { report: LaisrReport }) {
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

function severityLabel(severity: Severity) {
  return {
    info: "Info",
    notable: "Notable",
    serious: "Serious",
    critical: "Critical"
  }[severity];
}

function recommendationClass(recommendation: LaisrReport["summary"]["recommendation"]) {
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

function finalJudgementReady(report: LaisrReport) {
  return report.aiReview.status === "completed";
}

function plainFindingSummary(finding: LaisrReport["findings"][number]) {
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

  return "This is a review signal, not an accusation. It should be read alongside the rest of the evidence and any explanation the candidate can give.";
}

function plainFindingObservation(finding: LaisrReport["findings"][number]) {
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
    const density = evidence.match(/around ([\d.]+) per/i)?.[1];
    return count && density
      ? `The essay uses ${count} formal transition phrases, about ${density} per 1,000 words.`
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

function getFindingParagraphRange(finding: LaisrReport["findings"][number], paragraphCount: number) {
  const text = `${finding.location || ""} ${finding.evidence}`;
  const explicitRange = text.match(/paragraphs?\s+(\d+)(?:[-–](\d+))?/i);

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

function paragraphInRange(index: number, range: { start: number; end: number } | null) {
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

function aiStatus(status: LaisrReport["aiReview"]["status"]) {
  return {
    completed: "AI review completed",
    failed: "AI review unavailable",
    pending: "AI review in progress",
    not_configured: "AI review not configured"
  }[status];
}
