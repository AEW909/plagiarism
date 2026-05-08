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
      evidenceOpinion: "AI plagiarism/authorship evidence review is not configured.",
      opinion: "AI analysis is not configured. Add OPENAI_API_KEY to enable the interpretive review layer.",
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
            "You are giving an academic integrity evidence opinion. Assess the text and the collected file/XML/style findings for possible plagiarism, AI assistance, patchwriting, or authorship inconsistency. Explain technical file evidence in plain examiner-friendly language. Use cautious language and do not accuse."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Give the kind of concise opinion you would give if an examiner pasted this work and its DOCX forensic findings into an AI system and asked whether it shows indicators of plagiarism or AI involvement. Return JSON only with keys evidenceConcern and evidenceOpinion. evidenceConcern must be one of: none, low, moderate, high. Mention textual features, XML/file-structure clues in plain language, limitations, and whether the opinion supports or weakens further investigation.",
            textPreview: doc.text.slice(0, 9000),
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
    const evidenceParsed = JSON.parse(evidenceResponse.output_text || "{}") as Partial<AiReview>;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "developer",
          content:
            "You are an academic integrity review assistant for LAISR. Do not accuse a student of misconduct. Treat AI analysis as one interpretive evidence stream alongside metadata, XML, textual, stylometric, linguistic, and authenticated-work evidence. Use cautious language. Your task is to help an examiner decide whether further review or viva discussion is warranted."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Review this document text alongside algorithmic findings. Return JSON only with keys opinion, counterArgument, assessment, vivaQuestions. The opinion should interpret the evidence in the direction of the current recommendation. The counterArgument must argue the opposite side: if the current recommendation is low concern, make the strongest fair case for possible AI involvement or further investigation; if the current recommendation suggests review or viva, make the strongest fair innocent explanation. The assessment should say which argument currently holds most weight and why. Do not use percentage-likelihood claims. Only return vivaQuestions if the recommendation is Viva recommended or Strong viva recommended; otherwise return an empty array. vivaQuestions must be objects with question and rationale, linked to the text or findings where possible.",
            recommendation,
            textPreview: doc.text.slice(0, 9000),
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
      evidenceConcern: normaliseEvidenceConcern(evidenceParsed.evidenceConcern, evidenceParsed.evidenceOpinion),
      evidenceOpinion: evidenceParsed.evidenceOpinion || "AI evidence review completed but did not return an evidence opinion.",
      opinion: parsed.opinion || "AI review completed but did not return an opinion.",
      counterArgument: parsed.counterArgument || "No AI counter-argument was returned.",
      assessment: parsed.assessment || "No AI assessment was returned.",
      vivaQuestions: Array.isArray(parsed.vivaQuestions) ? parsed.vivaQuestions.slice(0, 8) : []
    };
  } catch (error) {
    return {
      enabled: true,
      status: "failed",
      evidenceConcern: "unavailable",
      evidenceOpinion: "AI evidence review failed while the algorithmic review completed.",
      opinion: "AI analysis failed while the algorithmic review completed.",
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
