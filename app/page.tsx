"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  FileQuestion,
  FileSearch,
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

export default function Home() {
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

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            <ShieldCheck size={16} />
            LAISR
          </p>
          <h1>Learning Authorship Integrity Signal Review</h1>
          <p className="lede">
            Upload a DOCX submission to collect forensic, linguistic, stylometric, and
            AI-assisted review signals for fair viva preparation.
          </p>
        </div>
      </section>

      <section className="upload-workspace">
        <div className="upload-stack">
          <label className="upload-zone">
            <Upload size={30} />
            <strong>{file ? file.name : "Choose DOCX submission"}</strong>
            <span>Document text and XML are analysed in this session.</span>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="upload-zone compact">
            <FileText size={24} />
            <strong>{authenticatedFile ? authenticatedFile.name : "Optional authenticated sample"}</strong>
            <span>Known student writing enables a style comparison.</span>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setAuthenticatedFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="details-panel">
          <label>
            Candidate ID
            <input
              value={candidateId}
              placeholder="Optional"
              onChange={(event) => setCandidateId(event.target.value)}
            />
          </label>
          <label>
            Subject or title
            <input
              value={subject}
              placeholder="Optional"
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <button className="primary-button" type="button" disabled={loading} onClick={analyseDocument}>
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
      </section>

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
        <section className="empty-state">
          <FileSearch size={28} />
          <p>Upload a DOCX file to generate a LAISR review.</p>
        </section>
      )}
    </main>
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
  return (
    <div className="findings-stack">
      <article className="panel evidence-overview">
        <h2>
          <SearchCheck size={18} />
          Evidence checklist
        </h2>
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
      </article>
    </div>
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
      <p className="plain-summary">{plainFindingSummary(finding)}</p>
      <p>{finding.evidence}</p>
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
        <p>Upload a known piece of the candidate's writing to compare style, sentence length, vocabulary range, and register against the submitted document.</p>
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
  if (finding.category === "XML Forensics") {
    return "This comes from the hidden structure inside the Word file rather than from the visible essay text. It is a provenance clue: useful for deciding what to ask about, but not proof by itself.";
  }

  if (finding.category === "Relationships and Embedded Objects") {
    return "This checks whether the Word file points to outside links, imported material, images, or embedded files. These traces can explain where content came from or how the final document was assembled.";
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

function aiStatus(status: LaisrReport["aiReview"]["status"]) {
  return {
    completed: "AI review completed",
    failed: "AI review unavailable",
    pending: "AI review in progress",
    not_configured: "AI review not configured"
  }[status];
}
