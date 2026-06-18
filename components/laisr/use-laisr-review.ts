"use client";

import { useEffect, useMemo, useState } from "react";
import { buildLocalFinalRecommendation } from "@/lib/laisr/final-recommendation";
import { buildAlgorithmicSections, buildSummarySection } from "@/lib/laisr/sections";
import type { FinalRecommendation, LaisrReport, ReviewSectionId, SectionAiReview } from "@/lib/laisr/types";

export type ReportTab = "document" | ReviewSectionId;
export type AppView = "home" | "single";
export type WorkflowStepId = "upload" | "document_review" | "evidence" | "ai_reviews" | "summary";

export function useLaisrReview() {
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
  const activeSection = activeTab === "document"
    ? undefined
    : visibleTabs.find((section) => section.id === activeTab) ?? visibleTabs[0];
  const completedAiReviews = Object.values(sectionAiReviews).filter(
    (review): review is SectionAiReview => Boolean(review && review.status === "completed")
  );
  const aiReviewInProgress = Object.values(sectionAiLoading).some(Boolean);
  const workflowStep: WorkflowStepId = !report
    ? "upload"
    : finalRecommendation
      ? "summary"
      : completedAiReviews.length > 0 || aiReviewInProgress
        ? "ai_reviews"
        : activeTab === "document"
          ? "document_review"
          : "evidence";

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
      setActiveTab("document");
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
    setActiveTab("document");
    setSectionAiReviews({});
    setSectionAiLoading({});
    setFinalRecommendation(null);
    setSummaryModalOpen(false);
    setView("home");
  }

  return {
    activeSection,
    activeTab,
    aiConfigured: Boolean(aiConfig?.aiConfigured),
    aiReviewInProgress,
    analysisStage,
    analyseDocument,
    authenticatedFile,
    candidateId,
    completedAiReviews,
    createFinalRecommendation,
    downloadJson,
    downloadPdf,
    error,
    file,
    finalRecommendation,
    includeVivaInPdf,
    loading,
    pdfLoading,
    report,
    resetReview,
    runSectionAi,
    sectionAiLoading,
    sectionAiReviews,
    setActiveTab,
    setAuthenticatedFile,
    setCandidateId,
    setFile,
    setIncludeVivaInPdf,
    setSubject,
    setSummaryModalOpen,
    setView,
    subject,
    summaryGenerating,
    summaryModalOpen,
    summarySection,
    view,
    visibleTabs,
    workflowStep
  };
}
