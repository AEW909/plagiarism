"use client";

import { Bot, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { aiConcernLabel, OUTCOMES } from "@/lib/laisr/display";
import type { AlgorithmicSection } from "@/lib/laisr/sections";
import type { AnalysisSummary, SectionAiReview } from "@/lib/laisr/types";

export function TabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
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

export function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ReasoningBlock({
  body,
  icon,
  title
}: {
  body: string;
  icon: ReactNode;
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

export function SectionHeader({
  aiConfigured,
  aiLoading,
  aiReview,
  judgement,
  onRunAi,
  section
}: {
  aiConfigured: boolean;
  aiLoading: boolean;
  aiReview?: SectionAiReview;
  judgement: string;
  onRunAi: () => void;
  section: AlgorithmicSection;
}) {
  return (
    <section className={`panel section-intro tone-${section.tone}`}>
      <div>
        <p className="eyebrow">{section.available ? "Section judgement" : "Optional section"}</p>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </div>
      <div className="section-actions">
        <mark className={`section-judgement tone-${section.tone}`}>{judgement}</mark>
        <button
          className="ai-review-button"
          type="button"
          disabled={!aiConfigured || aiLoading || !section.available}
          onClick={onRunAi}
          title={aiConfigured ? "Ask AI for a scoped second opinion" : "OPENAI_API_KEY is not configured"}
        >
          {aiLoading ? <Loader2 className="spin" size={16} /> : <Bot size={16} />}
          <span>{aiLoading ? "Reviewing" : "AI"}</span>
        </button>
      </div>
      <p className="section-summary">{section.summary}</p>
      {aiReview ? <SectionAiPanel review={aiReview} /> : null}
    </section>
  );
}

export function SectionAiPanel({ review }: { review: SectionAiReview }) {
  return (
    <div className={`section-ai-panel concern-${review.concern}`}>
      <strong>
        AI scoped opinion: {aiConcernLabel(review.concern)} - {review.concernScore}/10
      </strong>
      <p>{review.opinion}</p>
    </div>
  );
}

export function OutcomeScale({
  activeRecommendation
}: {
  activeRecommendation?: AnalysisSummary["recommendation"];
}) {
  return (
    <div className="outcome-ladder">
      {OUTCOMES.map((outcome) => (
        <div
          className={
            outcome.label === activeRecommendation
              ? `outcome-step active ${outcome.tone}`
              : `outcome-step faded ${outcome.tone}`
          }
          key={outcome.label}
        >
          <span>{outcome.label}</span>
          <p>{outcome.description}</p>
        </div>
      ))}
    </div>
  );
}
