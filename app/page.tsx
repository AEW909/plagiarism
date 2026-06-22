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
import type { ReactNode } from "react";
import {
  DocumentReviewTab,
  EvidenceOverviewTab,
  HomeOptions,
  SectionReviewTab,
  SingleUploadScreen,
  SummaryCreationModal,
  SummaryRecommendationTab
} from "@/components/laisr/app-sections";
import { useLaisrReview, type ReportTab } from "@/components/laisr/use-laisr-review";
import { SummaryItem, TabButton, WorkflowGuide, type WorkflowStep } from "@/components/laisr/ui-primitives";

const TAB_ICONS: Record<ReportTab, ReactNode> = {
  document: <FileText size={17} />,
  overview: <FileSearch size={17} />,
  metadata: <FileSearch size={17} />,
  textual: <FileSearch size={17} />,
  comparative: <UserCheck size={17} />,
  ai_prose: <Bot size={17} />,
  summary: <Scale size={17} />
};

export default function Home() {
  const review = useLaisrReview();
  const reportTabs = review.report
    ? [
        { id: "document" as const, label: "Document Review" },
        { id: "overview" as const, label: "Evidence Overview" },
        ...review.visibleTabs
      ]
    : [];
  const workflowSteps = buildWorkflowSteps({
    completedAiCount: review.completedAiReviews.length,
    hasFinalRecommendation: Boolean(review.finalRecommendation),
    hasReport: Boolean(review.report),
    step: review.workflowStep
  });

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
        {review.view !== "home" || review.report ? (
          <button className="outline-button compact-action" type="button" onClick={review.resetReview}>
            <ArrowLeft size={16} />
            Home
          </button>
        ) : null}
      </header>

      {review.report ? (
        <section className="report">
          <WorkflowGuide
            steps={workflowSteps}
            title={review.finalRecommendation ? review.finalRecommendation.recommendation : "Evidence gathered"}
          >
            <button className="primary-button" type="button" onClick={() => review.setSummaryModalOpen(true)}>
              {review.finalRecommendation ? "Update summary" : "Create summary"}
            </button>
          </WorkflowGuide>

          <div className="summary-grid">
            <SummaryItem label="File" value={review.report.summary.fileName} />
            <SummaryItem label="Candidate" value={review.report.summary.candidateId} />
            <SummaryItem label="Words" value={String(review.report.summary.wordCount)} />
            <SummaryItem label="Paragraphs" value={String(review.report.summary.paragraphCount)} />
            <SummaryItem label="Consistency" value={`${review.report.linguisticProfile.consistencyScore}/100`} />
          </div>

          <section className="tab-shell">
            <div className="tabs" role="tablist" aria-label="LAISR report sections">
              {reportTabs.map((section) => (
                <TabButton
                  active={review.activeTab === section.id}
                  icon={TAB_ICONS[section.id]}
                  key={section.id}
                  label={section.id === "ai_prose" ? "AI opinion" : section.id === "summary" ? "Summary" : section.label}
                  onClick={() => review.setActiveTab(section.id)}
                />
              ))}
            </div>

            <div className="tab-panel">
              {review.activeTab === "document" ? (
                <DocumentReviewTab report={review.report} />
              ) : review.activeTab === "overview" ? (
                <EvidenceOverviewTab
                  completedAiCount={review.completedAiReviews.length}
                  onOpenTab={review.setActiveTab}
                  report={review.report}
                  sectionAiLoading={review.sectionAiLoading}
                />
              ) : review.activeSection?.id === "summary" && review.summarySection ? (
                <SummaryRecommendationTab
                  completedAiReviews={review.completedAiReviews}
                  finalRecommendation={review.finalRecommendation}
                  generatingSummary={review.summaryGenerating}
                  includeVivaInPdf={review.includeVivaInPdf}
                  onCreateSummary={() => review.setSummaryModalOpen(true)}
                  onDownloadJson={review.downloadJson}
                  onDownloadPdf={review.downloadPdf}
                  onToggleViva={review.setIncludeVivaInPdf}
                  pdfLoading={review.pdfLoading}
                  report={review.report}
                  section={review.summarySection}
                />
              ) : review.activeSection ? (
                <SectionReviewTab
                  aiConfigured={review.aiConfigured}
                  aiLoading={Boolean(review.sectionAiLoading[review.activeSection.id])}
                  aiReview={review.sectionAiReviews[review.activeSection.id]}
                  onRunAi={() => {
                    if (review.activeSection) {
                      review.runSectionAi(review.activeSection.id);
                    }
                  }}
                  report={review.report}
                  section={review.activeSection}
                />
              ) : null}
            </div>
          </section>

          {review.summaryModalOpen && review.summarySection ? (
            <SummaryCreationModal
              aiConfigured={review.aiConfigured}
              completedAiReviews={review.completedAiReviews}
              generating={review.summaryGenerating}
              onClose={() => review.setSummaryModalOpen(false)}
              onCreate={review.createFinalRecommendation}
            />
          ) : null}
          {review.error ? <p className="error-text">{review.error}</p> : null}
        </section>
      ) : (
        <>
          {review.view === "home" ? <HomeOptions onSingleUpload={() => review.setView("single")} /> : null}
          {review.view === "single" ? (
            <SingleUploadScreen
              aiLoading={false}
              analysisStage={review.analysisStage}
              authenticatedFile={review.authenticatedFile}
              candidateId={review.candidateId}
              error={review.error}
              file={review.file}
              loading={review.loading}
              subject={review.subject}
              onAnalyse={review.analyseDocument}
              onAuthenticatedFileChange={review.setAuthenticatedFile}
              onBack={() => review.setView("home")}
              onCandidateIdChange={review.setCandidateId}
              onFileChange={review.setFile}
              onSubjectChange={review.setSubject}
            />
          ) : null}
        </>
      )}
    </main>
  );
}

function buildWorkflowSteps({
  completedAiCount,
  hasFinalRecommendation,
  hasReport,
  step
}: {
  completedAiCount: number;
  hasFinalRecommendation: boolean;
  hasReport: boolean;
  step: "upload" | "document_review" | "evidence" | "ai_reviews" | "summary";
}): WorkflowStep[] {
  return [
    {
      id: "upload",
      label: "Upload",
      description: hasReport ? "Document loaded" : "Choose a DOCX file",
      status: hasReport ? "complete" : step === "upload" ? "current" : "available"
    },
    {
      id: "document_review",
      label: "Document review",
      description: hasReport ? "Preview text and annotations" : "Available after upload",
      status: !hasReport ? "locked" : step === "document_review" ? "current" : "complete"
    },
    {
      id: "evidence",
      label: "Evidence",
      description: hasReport ? "Overview and forensic sections" : "Available after document review",
      status: !hasReport
        ? "locked"
        : step === "document_review"
          ? "available"
          : step === "evidence"
            ? "current"
            : "complete"
    },
    {
      id: "ai_reviews",
      label: "AI reviews",
      description: completedAiCount ? `${completedAiCount} completed` : "Optional scoped opinions",
      status: !hasReport
        ? "locked"
        : hasFinalRecommendation
          ? "complete"
          : step === "ai_reviews"
            ? "current"
            : "available"
    },
    {
      id: "summary",
      label: "Summary",
      description: hasFinalRecommendation ? "Recommendation created" : "Create when ready",
      status: hasFinalRecommendation ? "complete" : step === "summary" ? "current" : hasReport ? "available" : "locked"
    }
  ];
}
