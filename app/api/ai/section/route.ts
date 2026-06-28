import { NextResponse } from "next/server";
import OpenAI from "openai";
import { sectionPayload } from "@/lib/laisr/sections";
import { clampScore } from "@/lib/laisr/final-recommendation";
import type { LaisrReport, ReviewSectionId, SectionAiReview, SectionConcern } from "@/lib/laisr/types";

export const runtime = "nodejs";

const SECTION_PROMPTS: Record<ReviewSectionId, string> = {
  metadata:
    "You are reviewing only metadata and file-forensic findings. Give a plain-English second opinion on what this section may and may not indicate. Do not discuss essay prose, AI writing style, or authenticated writing comparison.",
  textual:
    "You are reviewing only textual anomalies, tone, style, repetition, complexity, and register findings. Give a plain-English second opinion on what this section may and may not indicate. Do not discuss metadata, XML, RSIDs, or authenticated comparison.",
  comparative:
    "You are comparing only the visible submitted writing with the visible authenticated writing sample. Give a plain-English opinion on whether the two samples appear broadly consistent or divergent. Do not discuss metadata, XML, RSIDs, file history, or algorithmic metrics.",
  ai_prose:
    "You can see only the visible submitted essay text. Give a prose-only opinion on whether the writing itself shows evidence of AI use, AI-assisted rewriting, close paraphrase, patchwriting, or inconsistent authorship. Do not discuss metadata, XML, RSIDs, formatting, or file history.",
  summary:
    "You are reviewing the full LAISR evidence summary across sections. Weigh reliability, innocuous explanations, clustering, and whether a viva could fairly test the concern. Give a recommendation, not a misconduct finding."
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 400 });
  }

  try {
    const body = await request.json() as {
      report?: LaisrReport;
      sectionId?: ReviewSectionId;
    };

    if (!body.report || !body.sectionId) {
      return NextResponse.json({ error: "A report and sectionId are required." }, { status: 400 });
    }

    const payload = sectionPayload(body.report, body.sectionId);
    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "developer",
          content:
            "You are an academic integrity review assistant. Use cautious, fair, plain-English language. Do not accuse the candidate of misconduct. Stay inside the supplied section scope."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              `${SECTION_PROMPTS[body.sectionId]} Return JSON only with keys concern, concernScore, summary, and opinion. concern must be one of low, moderate, high, unavailable. concernScore must be an integer from 1 to 10, where 1 means no meaningful concern and 10 means strong concern. summary must be one plain-English sentence of 22 words or fewer for a busy teacher. opinion should give the fuller review: strongest concern, strongest innocent explanation, and what an examiner could ask or check next.`,
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

    const parsed = JSON.parse(response.output_text || "{}") as Partial<SectionAiReview>;
    const review: SectionAiReview = {
      sectionId: body.sectionId,
      status: "completed",
      concern: normaliseConcern(parsed.concern),
      concernScore: clampScore(Number(parsed.concernScore)),
      summary: typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary
        : summariseOpinion(parsed.opinion),
      opinion: typeof parsed.opinion === "string" && parsed.opinion.trim()
        ? parsed.opinion
        : "AI returned no section opinion."
    };

    return NextResponse.json(review);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to complete section AI review."
      },
      { status: 400 }
    );
  }
}

function normaliseConcern(value: unknown): SectionConcern {
  return value === "low" || value === "moderate" || value === "high" || value === "unavailable"
    ? value
    : "unavailable";
}

function summariseOpinion(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "AI returned no short summary.";
  }

  const firstSentence = value.trim().split(/(?<=[.!?])\s+/)[0] || value.trim();
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}...` : firstSentence;
}
