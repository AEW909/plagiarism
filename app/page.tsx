"use client";

import {
  ArrowLeft,
  Bot,
  FileSearch,
  FileText,
  Scale,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  HomeOptions,
  SectionReviewTab,
  SingleUploadScreen,
  SummaryItem,
  SummaryCreationModal,
  SummaryRecommendationTab,
  TabButton
} from "@/components/laisr/app-sections";
import { buildLocalFinalRecommendation } from "@/lib/laisr/final-recommendation";
import { buildAlgorithmicSections, buildSummarySection } from "@/lib/laisr/sections";
import type { FinalRecommendation, LaisrReport, ReviewSectionId, SectionAiReview } from "@/lib/laisr/types";

type ReportTab = ReviewSectionId;
type AppView = "home" | "single";

const TAB_ICONS: Record<ReportTab, ReactNode> = {
  metadata: <FileSearch size={17} />,
  textual: <FileText size={17} />,
  comparative: <UserCheck size={17} />,
  ai_prose: <Bot size={17} />,
  summary: <Scale size={17} />
};

export default function Home() {
  const [view, setView] = useState<AppView>("home");
  const [file, setFile] = useState<File | null>(null);
  const [authenticatedFile, setAuthenticatedFile] = useState<File | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [subject, setSubject] = useState("");
  const [report, setReport] = useState<LaisrReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("metadata");
  const [includeVivaInPdf, setIncludeVivaInPdf] = useState(true);
  const [analysisStage, setAnalysisStage] = useState<"idle" | "deterministic" | "ai" | "complete">("idle");
  const [aiConfig, setAiConfig] = useState<{
    aiConfigured: boolean;
    model: string;
  } | null>(null);
  const [sectionAiReviews, setSectionAiReviews] = useState<Partial<Record<ReviewSectionId, SectionAiReview>>>({});
  const [sectionAiLoading, setSectionAiLoading] = useState<Partial<Record<ReviewSectionId, boolean>>>({});
  const [finalRecommendation, setFinalRecommendation] = useState<FinalRecommendation | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);

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

  const reportSections = useMemo(() => report ? buildAlgorithmicSections(report) : [], [report]);
  const summarySection = useMemo(() => report ? buildSummarySection(report) : null, [report]);
  const visibleTabs = useMemo(() => {
    const base = reportSections.filter((section) => section.id !== "comparative" || section.available);
    return summarySection ? [...base, summarySection] : base;
  }, [reportSections, summarySection]);

  async function analyseDocument() {
    if (!file) {
      setError("Choose a .docx file first.");
      return;
    }

    setLoading(true);
    setAnalysisStage("deterministic");
    setError("");
    setReport(null);
    setSectionAiReviews({});
    setFinalRecommendation(null);

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
      setActiveTab("metadata");
      setAnalysisStage("complete");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
      setAnalysisStage("idle");
    } finally {
      setLoading(false);
    }
  }

  async function runSectionAi(sectionId: ReviewSectionId) {
    if (!report) {
      return;
    }

    setSectionAiLoading((current) => ({
      ...current,
      [sectionId]: true
    }));
    setError("");

    try {
      const response = await fetch("/api/ai/section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          report,
          sectionId
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI section review failed.");
      }

      setSectionAiReviews((current) => ({
        ...current,
        [sectionId]: payload
      }));
    } catch (aiError) {
      setSectionAiReviews((current) => ({
        ...current,
        [sectionId]: {
          sectionId,
          status: "failed",
          concern: "unavailable",
          concernScore: 1,
          opinion: aiError instanceof Error ? aiError.message : "AI section review failed."
        }
      }));
    } finally {
      setSectionAiLoading((current) => ({
        ...current,
        [sectionId]: false
      }));
    }
  }

  async function createFinalRecommendation({
    includeFinalAiOpinion,
    selectedAiSectionIds
  }: {
    includeFinalAiOpinion: boolean;
    selectedAiSectionIds: ReviewSectionId[];
  }) {
    if (!report) {
      return;
    }

    const selectedAiReviews = selectedAiSectionIds
      .map((sectionId) => sectionAiReviews[sectionId])
      .filter((review): review is SectionAiReview => Boolean(review && review.status === "completed"));

    setSummaryGenerating(true);
    setError("");

    try {
      if (includeFinalAiOpinion) {
        const response = await fetch("/api/ai/final", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            report,
            selectedAiReviews
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Final AI recommendation failed.");
        }

        setFinalRecommendation(payload);
      } else {
        setFinalRecommendation(buildLocalFinalRecommendation(report, selectedAiReviews));
      }

      setSummaryModalOpen(false);
      setActiveTab("summary");
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Unable to create final recommendation.");
    } finally {
      setSummaryGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!report) {
      return;
    }

    const exportReport = finalRecommendation
      ? { ...report, finalRecommendation }
      : report;

    setPdfLoading(true);
    setError("");

    try {
      const response = await fetch("/api/report/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          report: exportReport,
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
      link.download = `${exportReport.summary.fileName.replace(/\.docx$/i, "")}_laisr_report.pdf`;
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

    const exportReport = finalRecommendation
      ? { ...report, finalRecommendation }
      : report;

    const blob = new Blob([JSON.stringify(exportReport, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportReport.summary.fileName.replace(/\.docx$/i, "")}_laisr_report.json`;
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
    setActiveTab("metadata");
    setSectionAiReviews({});
    setSectionAiLoading({});
    setFinalRecommendation(null);
    setSummaryModalOpen(false);
    setView("home");
  }

  const activeSection = visibleTabs.find((section) => section.id === activeTab) ?? visibleTabs[0];

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
          <div className="recommendation">
            <div>
              <p className="eyebrow">
                Sectioned review
              </p>
              <strong>{finalRecommendation ? finalRecommendation.recommendation : "Evidence gathered"}</strong>
              <span>
                {finalRecommendation
                  ? `Final concern score ${finalRecommendation.concernScore}/10.`
                  : "No overall recommendation has been generated yet. Review the sections, then create the summary when the evidence is ready."}
              </span>
            </div>
            <button className="primary-button light" type="button" onClick={() => setSummaryModalOpen(true)}>
              View/Create Summary
            </button>
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
              {visibleTabs.map((section) => (
                <TabButton
                  active={activeTab === section.id}
                  icon={TAB_ICONS[section.id]}
                  key={section.id}
                  label={section.id === "ai_prose" ? "AI opinion" : section.id === "summary" ? "Summary" : section.label}
                  onClick={() => setActiveTab(section.id)}
                />
              ))}
            </div>

            <div className="tab-panel">
              {activeSection?.id === "summary" && summarySection ? (
                <SummaryRecommendationTab
                  completedAiReviews={Object.values(sectionAiReviews).filter((review): review is SectionAiReview => Boolean(review && review.status === "completed"))}
                  finalRecommendation={finalRecommendation}
                  generatingSummary={summaryGenerating}
                  onCreateSummary={() => setSummaryModalOpen(true)}
                  includeVivaInPdf={includeVivaInPdf}
                  onDownloadJson={downloadJson}
                  onDownloadPdf={downloadPdf}
                  onToggleViva={setIncludeVivaInPdf}
                  pdfLoading={pdfLoading}
                  report={report}
                  section={summarySection}
                />
              ) : activeSection ? (
                <SectionReviewTab
                  aiConfigured={Boolean(aiConfig?.aiConfigured)}
                  aiLoading={Boolean(sectionAiLoading[activeSection.id])}
                  aiReview={sectionAiReviews[activeSection.id]}
                  onRunAi={() => runSectionAi(activeSection.id)}
                  report={report}
                  section={activeSection}
                />
              ) : null}
            </div>
          </section>
          {summaryModalOpen && summarySection ? (
            <SummaryCreationModal
              aiConfigured={Boolean(aiConfig?.aiConfigured)}
              completedAiReviews={Object.values(sectionAiReviews).filter((review): review is SectionAiReview => Boolean(review && review.status === "completed"))}
              generating={summaryGenerating}
              onClose={() => setSummaryModalOpen(false)}
              onCreate={createFinalRecommendation}
            />
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      ) : (
        <>
          {view === "home" ? <HomeOptions onSingleUpload={() => setView("single")} /> : null}
          {view === "single" ? (
            <SingleUploadScreen
              aiLoading={false}
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
