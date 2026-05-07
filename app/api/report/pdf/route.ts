import { NextResponse } from "next/server";
import { renderLaisrPdf } from "@/lib/laisr/report-pdf";
import type { LaisrReport } from "@/lib/laisr/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as
      | LaisrReport
      | { report: LaisrReport; includeVivaQuestions?: boolean };
    const report = "report" in payload ? payload.report : payload;
    const includeVivaQuestions =
      "report" in payload ? payload.includeVivaQuestions !== false : true;

    if (!report?.summary?.fileName) {
      return NextResponse.json({ error: "A valid LAISR report payload is required." }, { status: 400 });
    }

    const buffer = await renderLaisrPdf(report, { includeVivaQuestions });
    const fileName = `${report.summary.fileName.replace(/\.docx$/i, "")}_laisr_report.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF report." },
      { status: 400 }
    );
  }
}
