import OpenAI from "openai";
import type { ExtractedDocx } from "./docx";
import type { AiReview, AnalysisSummary, Finding } from "./types";

export async function runAiReview(
  doc: ExtractedDocx,
  findings: Finding[],
  recommendation: AnalysisSummary["recommendation"]
): Promise<AiReview> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      enabled: false,
      status: "not_configured",
      evidenceConcern: "not_run",
      evidenceOpinion: "AI text review is not configured.",
      opinion: "AI review is not configured. Add OPENAI_API_KEY to enable the text-only review and synthesis layers.",
      counterArgument: "The algorithmic review remains available without AI analysis.",
      assessment: "No AI opinion was generated for this report.",
      vivaQuestions: []
    };
  }

  try {
    const client = new OpenAI();
    const evidenceResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "developer",
          content:
            "You are giving a text-only academic integrity opinion. You can see only the visible essay prose. Comment only on wording, argument, source-use signals, paraphrase/patchwriting signals, AI-like prose features, and authorship consistency visible in the prose itself. Use cautious language and do not accuse."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "An examiner has pasted only the visible essay text. Give a concise prose-only academic integrity opinion. Consider whether the writing itself raises concern about direct copying, close paraphrase, source patchwriting, AI-assisted writing or rewriting, or inconsistent authorship. Return JSON only with keys evidenceConcern and evidenceOpinion. evidenceConcern must be one of: none, low, moderate, high. Mention specific wording, reasoning, citation/source-use, repetition, or passage-level features where useful. Do not claim that a passage appears online unless a supplied source or explicit search result supports that claim. Do not refer to any file-forensic, formatting, hidden-document, editing-history, or non-visible evidence.",
            textPreview: doc.text.slice(0, 9000)
          })
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    });
    const evidenceParsed = JSON.parse(evidenceResponse.output_text || "{}") as Partial<AiReview>;
    const evidenceConcern = normaliseEvidenceConcern(evidenceParsed.evidenceConcern, evidenceParsed.evidenceOpinion);
    const evidenceOpinion = enforceTextOnlyOpinion(
      evidenceParsed.evidenceOpinion || "AI text review completed but did not return an evidence opinion."
    );

    try {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5",
        input: [
          {
            role: "developer",
            content:
              "You are an academic integrity synthesis assistant for LAISR. Do not accuse a student of misconduct. The text-only AI review is one evidence stream alongside metadata, XML, textual, stylometric, linguistic, authenticated-work, and source-use evidence. Use cautious language. Your task is to help an examiner decide whether further review or viva discussion is warranted."
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Review the full evidence package. Return JSON only with keys opinion, counterArgument, assessment, vivaQuestions. The opinion should be the interpretive case: what is the strongest academic-integrity concern raised by all available evidence, including the text-only AI review and deterministic findings? The counterArgument must be the strongest fair opposing case: if the current recommendation is low concern, make the best case for possible malpractice or further investigation; if the current recommendation suggests review or viva, make the best innocent/process-based explanation. The assessment should weigh the two cases and say which currently holds more weight and why, making clear that LAISR is making a triage recommendation rather than a misconduct finding. Consider direct copying, close paraphrase, source patchwriting, AI-assisted rewriting, undisclosed human assistance, contract-cheating/process concerns, document assembly, and authorship inconsistency. Do not use percentage-likelihood claims. Do not claim online matches unless source-search evidence has been supplied. Only return vivaQuestions if the recommendation is Viva recommended or Strong viva recommended; otherwise return an empty array. vivaQuestions must be objects with question and rationale, linked to the text or findings where possible.",
              recommendation,
              textPreview: doc.text.slice(0, 9000),
              textOnlyAiReview: {
                evidenceConcern,
                evidenceOpinion
              },
              findings: findings.map((finding) => ({
                category: finding.category,
                severity: finding.severity,
                title: finding.title,
                evidence: finding.evidence,
                normalRange: finding.normalRange,
                location: finding.location
              }))
            })
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      });

      const parsed = JSON.parse(response.output_text || "{}") as Partial<AiReview>;
      return {
        enabled: true,
        status: "completed",
        evidenceConcern,
        evidenceOpinion,
        opinion: parsed.opinion || "AI synthesis completed but did not return an interpretation.",
        counterArgument: parsed.counterArgument || "No AI counter-argument was returned.",
        assessment: parsed.assessment || "No AI assessment was returned.",
        vivaQuestions: Array.isArray(parsed.vivaQuestions) ? parsed.vivaQuestions.slice(0, 8) : []
      };
    } catch (error) {
      return {
        enabled: true,
        status: "failed",
        evidenceConcern,
        evidenceOpinion,
        opinion: "The text-only AI review completed, but the evidence synthesis step failed.",
        counterArgument: "Do not treat absence of AI synthesis as evidence either way.",
        assessment: error instanceof Error ? error.message : "Unknown AI synthesis error.",
        vivaQuestions: []
      };
    }
  } catch (error) {
    return {
      enabled: true,
      status: "failed",
      evidenceConcern: "unavailable",
      evidenceOpinion: "AI text review failed while the algorithmic review completed.",
      opinion: "AI review failed while the algorithmic review completed.",
      counterArgument: "Do not treat absence of AI output as evidence either way.",
      assessment: error instanceof Error ? error.message : "Unknown AI review error.",
      vivaQuestions: []
    };
  }
}

function normaliseEvidenceConcern(value: unknown, evidenceOpinion?: string) {
  if (value === "none" || value === "low" || value === "moderate" || value === "high") {
    return value;
  }

  return inferConcernFromText(evidenceOpinion || "");
}

function enforceTextOnlyOpinion(opinion: string) {
  const forbiddenPattern =
    /\b(?:docx|metadata|xml|rsid|rsids|edit-session|revision count|tracked changes|hidden text|white text|font|fonts|webkit|package|zip|relationship files?|embedded objects?|custom xml|file structure|document properties|formatting residue)\b/i;
  if (!forbiddenPattern.test(opinion)) {
    return opinion;
  }

  const proseOnlySentences = opinion
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !forbiddenPattern.test(sentence));

  if (proseOnlySentences.length > 0) {
    return `${proseOnlySentences.join(" ")} This Stage 1 review is limited to the visible prose only; file-forensic evidence is handled separately in the synthesis stage.`;
  }

  return "The text-only AI review returned comments outside its intended scope, so LAISR has withheld that wording. Treat the Stage 1 AI evidence stream as unavailable for this run and rely on the separate deterministic findings plus the synthesis stage.";
}

function inferConcernFromText(text: string): AiReview["evidenceConcern"] {
  const lowered = text.toLowerCase();

  if (/\b(no|not|does not|doesn't)\b.{0,60}\b(indicator|evidence|sign|support|suggest)/.test(lowered)) {
    return "none";
  }

  if (/\b(strong|substantial|significant|clear|multiple|clustered)\b.{0,80}\b(ai|plagiarism|patchwriting|copied|authorship|further investigation|viva)/.test(lowered)) {
    return "high";
  }

  if (/\b(moderate|some|several|possible|plausible|supports|suggests|indicators?)\b.{0,80}\b(ai|plagiarism|patchwriting|copied|authorship|further investigation|viva)/.test(lowered)) {
    return "moderate";
  }

  if (/\b(low|limited|weak|minor)\b.{0,80}\b(indicator|concern|evidence|support)/.test(lowered)) {
    return "low";
  }

  return "low";
}
