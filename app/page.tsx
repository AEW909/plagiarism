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
import { useEffect, useMemo, useState } from "react";
import type { LaisrReport, Severity } from "@/lib/laisr/types";

type ReportTab = "evidence" | "interpretation" | "counter" | "judgement";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [subject, setSubject] = useState("");
  const [report, setReport] = useState<LaisrReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("evidence");
  const [includeVivaInPdf, setIncludeVivaInPdf] = useState(true);
  const [aiConfig, setAiConfig] = useState<{
    aiConfigured: boolean;
    model: string;
  } | null>(null);

  const groupedFindings = useMemo(() => {
    return (report?.findings ?? []).reduce<Record<string, LaisrReport["findings"]>>(
      (groups, finding) => {
        groups[finding.category] = groups[finding.category] ?? [];
        groups[finding.category].push(finding);
        return groups;
      },
      {}
    );
  }, [report]);

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
    setError("");
    setReport(null);

    const formData = new FormData();
    formData.append("file", file);
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

      if (aiConfig?.aiConfigured) {
        await enrichWithAi(file, candidateId, subject);
      }
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function enrichWithAi(selectedFile: File, selectedCandidateId: string, selectedSubject: string) {
    setAiLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
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
    } catch (aiError) {
      setReport((currentReport) =>
        currentReport
          ? {
              ...currentReport,
              aiReview: {
                enabled: true,
                status: "failed",
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
          <div className={aiConfig?.aiConfigured ? "config-pill ready" : "config-pill"}>
            {aiLoading ? <Loader2 className="spin" size={15} /> : <Brain size={15} />}
            {aiConfig
              ? aiLoading
                ? `AI review running (${aiConfig.model})`
                : aiConfig.aiConfigured
                  ? `AI review enabled (${aiConfig.model})`
                : "AI review not configured"
              : "Checking AI configuration..."}
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>

      {report ? (
        <section className="report">
          <div className={`recommendation ${recommendationClass(report.summary.recommendation)}`}>
            <div>
              <p className="eyebrow">
                <AlertTriangle size={16} />
                Review recommendation
              </p>
              <strong>{report.summary.recommendation}</strong>
              <span>
                {report.summary.seriousCount} serious/critical indicators{" - "}
                {report.summary.notableCount} notable indicators
              </span>
            </div>
          </div>

          <div className="summary-grid">
            <SummaryItem label="File" value={report.summary.fileName} />
            <SummaryItem label="Candidate" value={report.summary.candidateId} />
            <SummaryItem label="Words" value={String(report.summary.wordCount)} />
            <SummaryItem label="Paragraphs" value={String(report.summary.paragraphCount)} />
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
                <EvidenceTab groupedFindings={groupedFindings} report={report} />
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

function EvidenceTab({
  groupedFindings,
  report
}: {
  groupedFindings: Record<string, LaisrReport["findings"]>;
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
                {check.findingIds.length > 0 ? (
                  <ul className="linked-findings">
                    {check.findingIds.map((findingId) => {
                      const finding = report.findings.find((item) => item.id === findingId);
                      return finding ? <li key={finding.id}>{finding.title}</li> : null;
                    })}
                  </ul>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </article>

      {Object.entries(groupedFindings).length > 0 ? (
        Object.entries(groupedFindings).map(([category, findings]) => (
          <article className="panel" key={category}>
            <h2>{category}</h2>
            <div className="finding-list">
              {findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </article>
        ))
      ) : (
        <article className="panel">
          <h2>No indicators detected</h2>
          <p className="muted">
            The current checks did not surface notable indicators in this document.
            This does not prove authorship; it simply means these review signals did
            not trigger.
          </p>
        </article>
      )}
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
  const vivaRecommended =
    report.summary.recommendation === "Viva recommended" ||
    report.summary.recommendation === "Strong viva recommended";

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
                outcome.label === report.summary.recommendation
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
        body={report.assessment}
        icon={<CheckCircle2 size={18} />}
        title="Final judgement"
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
          <button className="primary-button" type="button" disabled={pdfLoading} onClick={onDownloadPdf}>
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
            Viva questions are not generated because the current judgement does not
            recommend a viva. If later evidence changes the outcome, this section will
            appear collapsed with targeted questions.
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
      <p>{finding.evidence}</p>
      <dl>
        {finding.normalRange ? (
          <div>
            <dt>Normal range / benchmark</dt>
            <dd>{finding.normalRange}</dd>
          </div>
        ) : null}
        <div>
          <dt>Interpretation</dt>
          <dd>{finding.interpretation}</dd>
        </div>
        <div>
          <dt>Counter-argument</dt>
          <dd>{finding.counterArgument}</dd>
        </div>
        <div>
          <dt>Viva angle</dt>
          <dd>{finding.vivaAngle}</dd>
        </div>
      </dl>
    </article>
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

function aiStatus(status: LaisrReport["aiReview"]["status"]) {
  return {
    completed: "AI review completed",
    failed: "AI review unavailable",
    pending: "AI review in progress",
    not_configured: "AI review not configured"
  }[status];
}
