export type Severity = "info" | "notable" | "serious" | "critical";

export type Finding = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  evidence: string;
  location?: string;
  interpretation: string;
  counterArgument: string;
  vivaAngle: string;
};

export type DocumentMetadata = {
  creator: string;
  lastModifiedBy: string;
  created: string;
  modified: string;
  revision: string;
  totalTimeMinutes: string;
  wordCount: string;
  pages: string;
  application: string;
};

export type AnalysisSummary = {
  fileName: string;
  candidateId: string;
  subject: string;
  wordCount: number;
  paragraphCount: number;
  seriousCount: number;
  notableCount: number;
  recommendation:
    | "No significant indicators detected"
    | "Examiner review recommended"
    | "Viva recommended"
    | "Strong viva recommended";
};

export type AiReview = {
  enabled: boolean;
  status: "not_configured" | "completed" | "failed";
  opinion: string;
  counterArgument: string;
  assessment: string;
  vivaQuestions: VivaQuestion[];
};

export type VivaQuestion = {
  question: string;
  rationale: string;
  linkedFinding?: string;
};

export type LaisrReport = {
  summary: AnalysisSummary;
  metadata: DocumentMetadata;
  findings: Finding[];
  interpretation: string;
  counterArgument: string;
  assessment: string;
  vivaQuestions: VivaQuestion[];
  aiReview: AiReview;
  extractedTextPreview: string;
};
