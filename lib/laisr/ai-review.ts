import OpenAI from "openai";
import type { ExtractedDocx } from "./docx";
import type { AiReview, Finding } from "./types";

export async function runAiReview(doc: ExtractedDocx, findings: Finding[]): Promise<AiReview> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      enabled: false,
      status: "not_configured",
      opinion: "AI analysis is not configured. Add OPENAI_API_KEY to enable the interpretive review layer.",
      counterArgument: "The algorithmic review remains available without AI analysis.",
      assessment: "No AI opinion was generated for this report.",
      vivaQuestions: []
    };
  }

  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "developer",
          content:
            "You are an academic integrity review assistant for LAISR. Do not accuse a student of misconduct. Treat AI analysis as one interpretive evidence stream alongside metadata, XML, textual, stylometric, linguistic, and authenticated-work evidence. Use cautious language. Your task is to help an examiner decide whether further review or viva discussion is warranted, and to generate fair questions that let a candidate demonstrate authorship."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Review this document text alongside algorithmic findings. Return JSON only with keys opinion, counterArgument, assessment, vivaQuestions. The opinion should interpret evidence for and against further investigation. The counterArgument should present plausible innocent explanations. The assessment should say which argument currently holds most weight and whether viva discussion would be proportionate. Do not use percentage-likelihood claims. vivaQuestions must be an array of objects with question and rationale, linked to the text or findings where possible.",
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
      opinion: parsed.opinion || "AI review completed but did not return an opinion.",
      counterArgument: parsed.counterArgument || "No AI counter-argument was returned.",
      assessment: parsed.assessment || "No AI assessment was returned.",
      vivaQuestions: Array.isArray(parsed.vivaQuestions) ? parsed.vivaQuestions.slice(0, 8) : []
    };
  } catch (error) {
    return {
      enabled: true,
      status: "failed",
      opinion: "AI analysis failed while the algorithmic review completed.",
      counterArgument: "Do not treat absence of AI output as evidence either way.",
      assessment: error instanceof Error ? error.message : "Unknown AI review error.",
      vivaQuestions: []
    };
  }
}
