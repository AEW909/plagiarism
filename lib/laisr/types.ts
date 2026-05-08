export type Severity = "info" | "notable" | "serious" | "critical";

export type Finding = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  evidence: string;
  normalRange?: string;
  location?: string;
  interpretation: string;
  counterArgument: string;
  vivaAngle: string;
};

export type EvidenceCheck = {
  id: string;
  label: string;
  category: string;
  status: "clear" | "issues";
  summary: string;
  detail: string;
  findingIds: string[];
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
  template: string;
  company: string;
  appVersion: string;
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
  status: "not_configured" | "pending" | "completed" | "failed";
  evidenceConcern: "not_run" | "none" | "low" | "moderate" | "high" | "unavailable";
  evidenceOpinion: string;
  opinion: string;
  counterArgument: string;
  assessment: string;
  vivaQuestions: VivaQuestion[];
};

export type LinguisticSegment = {
  index: number;
  wordCount: number;
  fkGrade: number;
  fogIndex: number;
  typeTokenRatio: number;
  formalDensity: number;
  passiveDensity: number;
  complexityBand: "low" | "normal" | "high";
  registerBand: "normal" | "high";
  passiveBand: "normal" | "high";
  opening: string;
};

export type LinguisticProfile = {
  meanFkGrade: number;
  meanFogIndex: number;
  meanFormalDensity: number;
  meanPassiveDensity: number;
  consistencyScore: number;
  consistencyLabel: string;
  segments: LinguisticSegment[];
};

export type ComparativeMetric = {
  label: string;
  submitted: number;
  authenticated: number;
  difference: number;
  severity: "clear" | "notable" | "critical";
};

export type ComparativeProfile = {
  available: boolean;
  sampleFileName?: string;
  score: number;
  label: string;
  metrics: ComparativeMetric[];
  summary: string;
};

export type VivaQuestion = {
  question: string;
  rationale: string;
  linkedFinding?: string;
};

export type LaisrReport = {
  summary: AnalysisSummary;
  metadata: DocumentMetadata;
  evidenceChecks: EvidenceCheck[];
  findings: Finding[];
  interpretation: string;
  counterArgument: string;
  assessment: string;
  vivaQuestions: VivaQuestion[];
  linguisticProfile: LinguisticProfile;
  comparativeProfile: ComparativeProfile;
  aiReview: AiReview;
  extractedTextPreview: string;
};
