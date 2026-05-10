import { NextResponse } from "next/server";
import { buildReport } from "@/lib/laisr/analyze";
import { extractDocx } from "@/lib/laisr/docx";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A .docx file is required." }, { status: 400 });
    }

    const authenticatedFile = formData.get("authenticatedFile");
    const candidateId = String(formData.get("candidateId") || "");
    const subject = String(formData.get("subject") || "");
    const doc = await extractDocx(file);
    const authenticatedDoc = authenticatedFile instanceof File && authenticatedFile.size > 0
      ? await extractDocx(authenticatedFile)
      : null;
    const report = buildReport({
      doc,
      authenticatedDoc,
      candidateId,
      subject,
      aiReview: {
        enabled: Boolean(process.env.OPENAI_API_KEY),
        status: process.env.OPENAI_API_KEY ? "pending" : "not_configured",
        evidenceConcern: "not_run",
        evidenceOpinion: process.env.OPENAI_API_KEY
          ? "Text-only AI evidence review is still running."
          : "Text-only AI evidence review is not configured.",
        opinion: process.env.OPENAI_API_KEY
          ? "Deterministic evidence is ready. AI evidence synthesis is still running."
          : "AI analysis is not configured. Add OPENAI_API_KEY to enable the text-only review and synthesis layers.",
        counterArgument: process.env.OPENAI_API_KEY
          ? "The AI counter-position will appear when the AI review completes."
          : "The algorithmic review remains available without AI analysis.",
        assessment: process.env.OPENAI_API_KEY
          ? "The final AI-assisted evidence weighing will update shortly."
          : "No AI opinion was generated for this report.",
        vivaQuestions: []
      }
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to analyse this document." },
      { status: 400 }
    );
  }
}
