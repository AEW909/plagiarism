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
  HomeOptions,
  SectionReviewTab,
  SingleUploadScreen,
  SummaryCreationModal,
  SummaryRecommendationTab
} from "@/components/laisr/app-sections";
import { useLaisrReview, type ReportTab } from "@/components/laisr/use-laisr-review";
import { SummaryItem, TabButton } from "@/components/laisr/ui-primitives";

const TAB_ICONS: Record<ReportTab, ReactNode> = {
  metadata: <FileSearch size={17} />,
  textual: <FileText size={17} />,
  comparative: <UserCheck size={17} />,
  ai_prose: <Bot size={17} />,
  summary: <Scale size={17} />
};

export default function Home() {
  const review = useLaisrReview();

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
          <div className="recommendation">
            <div>
              <p className="eyebrow">Sectioned review</p>
              <strong>{review.finalRecommendation ? review.finalRecommendation.recommendation : "Evidence gathered"}</strong>
              <span>
                {review.finalRecommendation
                  ? `Final concern score ${review.finalRecommendation.concernScore}/10.`
                  : "No overall recommendation has been generated yet. Review the sections, then create the summary when the evidence is ready."}
              </span>
            </div>
            <button className="primary-button light" type="button" onClick={() => review.setSummaryModalOpen(true)}>
              View/Create Summary
            </button>
          </div>

          <div className="summary-grid">
            <SummaryItem label="File" value={review.report.summary.fileName} />
            <SummaryItem label="Candidate" value={review.report.summary.candidateId} />
            <SummaryItem label="Words" value={String(review.report.summary.wordCount)} />
            <SummaryItem label="Paragraphs" value={String(review.report.summary.paragraphCount)} />
            <SummaryItem label="Consistency" value={`${review.report.linguisticProfile.consistencyScore}/100`} />
          </div>

          <section className="tab-shell">
            <div className="tabs" role="tablist" aria-label="LAISR report sections">
              {review.visibleTabs.map((section) => (
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
              {review.activeSection?.id === "summary" && review.summarySection ? (
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
                  onRunAi={() => review.runSectionAi(review.activeSection.id)}
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
