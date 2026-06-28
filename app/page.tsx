"use client";

import {
  ArrowLeft
} from "lucide-react";
import {
  AnalysisProgressScreen,
  HomeOptions,
  SingleUploadScreen,
  TeacherReviewDashboard
} from "@/components/laisr/app-sections";
import { LaisrLogo } from "@/components/laisr/laisr-logo";
import { useLaisrReview } from "@/components/laisr/use-laisr-review";

const RUNNING_STATES = new Set([
  "running_file_checks",
  "running_ai_text_review",
  "running_final_synthesis"
]);

export default function Home() {
  const review = useLaisrReview();
  const isRunning = RUNNING_STATES.has(review.analysisStage);

  return (
    <main className="shell teacher-shell">
      <header className="app-header teacher-app-header">
        <div>
          <LaisrLogo compact />
          <span>Viva triage for submitted work</span>
        </div>
        {review.view !== "home" || review.report || isRunning ? (
          <button className="outline-button compact-action" type="button" onClick={review.resetReview}>
            <ArrowLeft size={16} />
            Home
          </button>
        ) : null}
      </header>

      {isRunning ? (
        <AnalysisProgressScreen
          aiConfigured={review.aiConfigured}
          aiReviewPlan={review.aiReviewPlan}
          error={review.error}
          fileName={review.file?.name}
          stage={review.analysisStage}
        />
      ) : review.report ? (
        <TeacherReviewDashboard
          aiConfigured={review.aiConfigured}
          analysisStage={review.analysisStage}
          finalRecommendation={review.finalRecommendation}
          includeVivaInPdf={review.includeVivaInPdf}
          onDownloadJson={review.downloadJson}
          onDownloadPdf={review.downloadPdf}
          onReset={review.resetReview}
          onToggleViva={review.setIncludeVivaInPdf}
          pdfLoading={review.pdfLoading}
          report={review.report}
          sectionAiReviews={review.sectionAiReviews}
        />
      ) : (
        <>
          {review.view === "home" ? <HomeOptions onSingleUpload={() => review.setView("single")} /> : null}
          {review.view === "single" ? (
            <SingleUploadScreen
              aiConfigured={review.aiConfigured}
              aiLoading={false}
              aiReviewPlan={review.aiReviewPlan}
              analysisStage={review.analysisStage}
              authenticatedFile={review.authenticatedFile}
              candidateId={review.candidateId}
              error={review.error}
              file={review.file}
              loading={review.loading}
              subject={review.subject}
              onAnalyse={review.analyseDocument}
              onAuthenticatedFileChange={review.setAuthenticatedFile}
              onAiReviewPlanChange={review.setAiReviewPlan}
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
