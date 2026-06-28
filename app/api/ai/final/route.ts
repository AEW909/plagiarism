import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildLocalFinalRecommendation, clampScore, recommendationFromScore } from "@/lib/laisr/final-recommendation";
import { plainFindingObservation, plainFindingSummary } from "@/lib/laisr/finding-presentation";
import { buildAlgorithmicSections } from "@/lib/laisr/sections";
import type { FinalRecommendation, LaisrReport, SectionAiReview } from "@/lib/laisr/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 400 });
  }

  try {
    const body = await request.json() as {
      report?: LaisrReport;
      selectedAiReviews?: SectionAiReview[];
    };

    if (!body.report) {
      return NextResponse.json({ error: "A report is required." }, { status: 400 });
    }

    const selectedAiReviews = body.selectedAiReviews || [];
    const localRecommendation = buildLocalFinalRecommendation(body.report, selectedAiReviews);
    const payload = {
      algorithmicSections: buildAlgorithmicSections(body.report).map((section) => ({
        id: section.id,
        label: section.label,
        available: section.available,
        judgement: section.judgement,
        tone: section.tone,
        summary: section.summary,
        findings: section.findings.map((finding) => ({
          severity: finding.severity,
          group: teacherGroupForCategory(finding.category),
          whatWasFound: plainFindingObservation(finding),
          whyItMayMatter: plainFindingSummary(finding),
          otherPossibleExplanation: finding.counterArgument,
          vivaFollowUp: finding.vivaAngle
        }))
      })),
      selectedAiReviews: selectedAiReviews.map((review) => ({
        sectionId: review.sectionId,
        concern: review.concern,
        concernScore: review.concernScore,
        opinion: review.opinion
      })),
      localRecommendation
    };

    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "developer",
          content:
            "You are an academic integrity review assistant writing for a busy classroom teacher, not a forensic specialist. Produce a direct viva-triage recommendation, not a misconduct finding. Use only the supplied evidence summaries and selected AI section opinions. Use plain English. Avoid technical terms such as XML, RSID, stylometric, linguistic, provenance, probative, deterministic, clustered, cross-tool, or innocuous unless the word is essential; if it is essential, explain it in ordinary language."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Return JSON only with keys recommendation, concernScore, and rationale. recommendation must be one of: No significant indicators detected, Examiner review recommended, Viva recommended, Strong viva recommended. concernScore must be an integer from 1 to 10. The rationale must be under 130 words and formatted exactly with these labels and bullets: Bottom line:, Main reasons:, Other explanations:, Viva focus:. Use short sentences. No single paragraph. Do not list more than three main reasons. Say what the teacher should do next. Use phrases such as file history clues, pasted from another tool, unusual word choices, repeated wording, or writing-style changes instead of specialist jargon.",
            payload
          })
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    });

    const parsed = JSON.parse(response.output_text || "{}") as Partial<FinalRecommendation>;
    const concernScore = clampScore(Number(parsed.concernScore));
    const recommendation = normaliseRecommendation(parsed.recommendation, concernScore);

    return NextResponse.json({
      source: "ai_assisted",
      recommendation,
      concernScore,
      rationale: typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale
        : "AI returned no final rationale.",
      includedAiSections: selectedAiReviews.map((review) => review.sectionId),
      includedFinalAiOpinion: true
    } satisfies FinalRecommendation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate final recommendation." },
      { status: 400 }
    );
  }
}

function normaliseRecommendation(
  value: unknown,
  score: number
): FinalRecommendation["recommendation"] {
  if (
    value === "No significant indicators detected" ||
    value === "Examiner review recommended" ||
    value === "Viva recommended" ||
    value === "Strong viva recommended"
  ) {
    return value;
  }

  return recommendationFromScore(score);
}

function teacherGroupForCategory(category: string) {
  if (category === "Document Metadata" || category === "Package Forensics" || category === "XML Forensics" || category === "Relationships and Embedded Objects") {
    return "How the file was made";
  }

  if (category === "Textual Anomalies" || category === "Stylometric Indicators" || category === "Linguistic Consistency") {
    return "How the writing behaves";
  }

  if (category === "Authenticated Writing Comparison") {
    return "How it compares with known work";
  }

  return "Other review signal";
}
