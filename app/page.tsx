"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CounterArgumentTab,
  EvidenceTab,
  HomeOptions,
  InterpretationTab,
  JudgementTab,
  SingleUploadScreen,
  SummaryItem,
  TabButton
} from "@/components/laisr/app-sections";
import {
  finalJudgementReady,
  recommendationClass
} from "@/lib/laisr/finding-presentation";
import type { LaisrReport } from "@/lib/laisr/types";

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
                evidenceOpinion: "Text-only AI review failed while deterministic review remained available.",
                opinion: "AI evidence synthesis failed while deterministic review remained available.",
                counterArgument: "Do not treat absence of AI output as evidence either way.",
                assessment: aiError instanceof Error ? aiError.message : "AI review failed.",
                vivaQuestions: []
              },
              evidenceChecks: currentReport.evidenceChecks.map((check) =>
                check.id === "ai"
                  ? {
                      ...check,
                      status: "issues",
                      summary: "AI review failed",
                      detail: aiError instanceof Error ? aiError.message : "AI review failed."
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
                  : "Final judgement pending evidence synthesis"}
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
