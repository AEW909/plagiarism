import { NextResponse } from "next/server";
import { buildReport } from "@/lib/laisr/analyze";
import { runAiReview } from "@/lib/laisr/ai-review";
import { extractDocx } from "@/lib/laisr/docx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A .docx file is required." }, { status: 400 });
    }

    const candidateId = String(formData.get("candidateId") || "");
    const subject = String(formData.get("subject") || "");
    const doc = await extractDocx(file);
    const baseReport = buildReport({
      doc,
      candidateId,
      subject,
      aiReview: {
        enabled: Boolean(process.env.OPENAI_API_KEY),
        status: process.env.OPENAI_API_KEY ? "pending" : "not_configured",
        evidenceOpinion: "",
        opinion: "",
        counterArgument: "",
        assessment: "",
        vivaQuestions: []
      }
    });
    const aiReview = await runAiReview(doc, baseReport.findings, baseReport.summary.recommendation);
    const report = buildReport({ doc, candidateId, subject, aiReview });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete AI analysis." },
      { status: 400 }
    );
  }
}
