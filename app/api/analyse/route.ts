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
        status: "not_configured",
        evidenceConcern: "not_run",
        evidenceOpinion: "AI reviews now run on demand inside each section.",
        opinion: "The algorithmic review is complete. Use the robot buttons for optional, scoped AI opinions.",
        counterArgument: "The algorithmic review remains available without AI analysis.",
        assessment: "No AI opinion was generated automatically for this report.",
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
