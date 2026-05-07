"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  FileSearch,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LaisrReport, Severity } from "@/lib/laisr/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [subject, setSubject] = useState("");
  const [report, setReport] = useState<LaisrReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setLoading(false);
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
            Analyse document
          </button>
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
                {report.summary.seriousCount} serious/critical indicators ·{" "}
                {report.summary.notableCount} notable indicators
              </span>
            </div>
            <button className="secondary-button" type="button" onClick={downloadJson}>
              <Download size={18} />
              JSON
            </button>
          </div>

          <div className="summary-grid">
            <SummaryItem label="File" value={report.summary.fileName} />
            <SummaryItem label="Candidate" value={report.summary.candidateId} />
            <SummaryItem label="Words" value={String(report.summary.wordCount)} />
            <SummaryItem label="Paragraphs" value={String(report.summary.paragraphCount)} />
          </div>

          <section className="reasoning-grid">
            <ReasoningPanel icon={<FileText size={18} />} title="Interpretation" body={report.interpretation} />
            <ReasoningPanel icon={<Users size={18} />} title="Counter-argument" body={report.counterArgument} />
            <ReasoningPanel icon={<CheckCircle2 size={18} />} title="Which argument holds most water" body={report.assessment} />
          </section>

          <section className="panel ai-panel">
            <h2>
              <Brain size={18} />
              AI Textual Review
            </h2>
            <p className="status-pill">{aiStatus(report.aiReview.status)}</p>
            <div className="ai-copy">
              <p>{report.aiReview.opinion}</p>
              <p>{report.aiReview.counterArgument}</p>
              <p>{report.aiReview.assessment}</p>
            </div>
          </section>

          <section className="findings-stack">
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
          </section>

          <section className="panel">
            <h2>Suggested viva questions</h2>
            <div className="question-list">
              {report.vivaQuestions.map((question, index) => (
                <div className="question" key={`${question.question}-${index}`}>
                  <strong>{index + 1}. {question.question}</strong>
                  <p>{question.rationale}</p>
                </div>
              ))}
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReasoningPanel({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="panel reasoning-panel">
      <h2>
        {icon}
        {title}
      </h2>
      <p>{body}</p>
    </article>
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
    not_configured: "AI review not configured"
  }[status];
}
