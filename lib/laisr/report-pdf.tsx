import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from "@react-pdf/renderer";
import type { Finding, LaisrReport } from "./types";

const colours = {
  navy: "#0d2137",
  red: "#c0392b",
  redBg: "#fdf0ef",
  amber: "#d35400",
  amberBg: "#fef9f0",
  blue: "#1a5276",
  blueBg: "#eaf0f8",
  green: "#1e6b3c",
  greenBg: "#edf7f1",
  purple: "#6c3483",
  purpleBg: "#f5eef8",
  grey: "#f4f6f8",
  ink: "#1f2933",
  muted: "#5f6b76",
  line: "#d6dde5"
};

const styles = StyleSheet.create({
  page: {
    padding: 38,
    fontSize: 10,
    color: colours.ink,
    fontFamily: "Helvetica",
    lineHeight: 1.45
  },
  cover: {
    padding: 0
  },
  coverBand: {
    height: 138,
    backgroundColor: colours.navy,
    padding: 38,
    justifyContent: "center",
    borderLeftWidth: 12,
    borderLeftColor: colours.red
  },
  coverTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.1
  },
  coverSubtitle: {
    color: "#cbd8e6",
    fontSize: 11,
    marginTop: 10
  },
  coverBody: {
    padding: 38,
    gap: 14
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 11
  },
  metaGrid: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colours.line
  },
  metaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colours.line
  },
  lastMetaRow: {
    borderBottomWidth: 0
  },
  metaLabel: {
    width: "34%",
    padding: 8,
    backgroundColor: colours.grey,
    color: colours.navy,
    fontFamily: "Helvetica-Bold"
  },
  metaValue: {
    width: "66%",
    padding: 8
  },
  title: {
    color: colours.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    marginBottom: 12
  },
  sectionBanner: {
    marginTop: 14,
    marginBottom: 8,
    padding: 8,
    backgroundColor: colours.grey,
    borderBottomWidth: 1.5,
    borderBottomColor: colours.navy,
    color: colours.navy,
    fontFamily: "Helvetica-Bold",
    fontSize: 11
  },
  paragraph: {
    marginBottom: 8,
    color: colours.ink
  },
  muted: {
    color: colours.muted
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  summaryBox: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: colours.line,
    padding: 8
  },
  summaryLabel: {
    color: colours.muted,
    fontSize: 7,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4
  },
  summaryValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12
  },
  finding: {
    marginBottom: 9,
    padding: 9,
    borderLeftWidth: 3
  },
  findingTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 5
  },
  findingText: {
    fontSize: 9.5,
    marginBottom: 5
  },
  findingSubhead: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colours.muted,
    marginTop: 3
  },
  question: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colours.line
  },
  questionText: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 4
  },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 22,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colours.line,
    flexDirection: "row",
    justifyContent: "space-between",
    color: colours.muted,
    fontSize: 8
  }
});

export async function renderLaisrPdf(
  report: LaisrReport,
  options: { includeVivaQuestions?: boolean } = {}
) {
  return renderToBuffer(
    <LaisrPdf
      includeVivaQuestions={options.includeVivaQuestions !== false}
      report={report}
    />
  );
}

function LaisrPdf({
  includeVivaQuestions,
  report
}: {
  includeVivaQuestions: boolean;
  report: LaisrReport;
}) {
  const groupedFindings = groupFindings(report.findings);

  return (
    <Document
      title={`LAISR Report - ${report.summary.fileName}`}
      author="LAISR"
      subject="Academic integrity signal review"
      creator="LAISR"
    >
      <Page size="A4" style={[styles.page, styles.cover]} wrap>
        <View style={styles.coverBand}>
          <Text style={styles.coverTitle}>Learning Authorship Integrity Signal Review</Text>
          <Text style={styles.coverSubtitle}>
            Forensic indicators, interpretive review, counter-arguments, and viva preparation
          </Text>
        </View>
        <View style={styles.coverBody}>
          <Text style={[styles.badge, { backgroundColor: recommendationColour(report.summary.recommendation) }]}>
            {report.summary.recommendation}
          </Text>
          <MetadataRows
            rows={[
              ["File analysed", report.summary.fileName],
              ["Candidate", report.summary.candidateId],
              ["Subject", report.summary.subject],
              ["Word count", String(report.summary.wordCount)],
              ["Generated", new Date().toLocaleString("en-GB")],
              ["Classification", "Confidential review support"]
            ]}
          />
          <Text style={styles.paragraph}>
            This report identifies review signals and prepares viva questions. It does not determine
            misconduct or prove authorship either way.
          </Text>
        </View>
      </Page>

      <ReportPage title="Part 1 - Evidence Findings">
        <SummaryGrid report={report} />
        <Text style={styles.sectionBanner}>Document Metadata</Text>
        <MetadataRows
          rows={[
            ["Creator", report.metadata.creator],
            ["Last modified by", report.metadata.lastModifiedBy],
            ["Created", report.metadata.created],
            ["Modified", report.metadata.modified],
            ["Revision", report.metadata.revision],
            ["Total editing time", report.metadata.totalTimeMinutes],
            ["Word count", report.metadata.wordCount],
            ["Pages", report.metadata.pages],
            ["Application", report.metadata.application]
          ]}
        />
        {Object.entries(groupedFindings).map(([category, findings]) => (
          <View key={category}>
            <Text style={styles.sectionBanner}>{category}</Text>
            {findings.map((finding) => (
              <FindingCard finding={finding} key={finding.id} />
            ))}
          </View>
        ))}
        {report.findings.length === 0 ? (
          <Text style={styles.paragraph}>No indicators were detected by the current checks.</Text>
        ) : null}
      </ReportPage>

      <ReportPage title="Part 2 - Interpretation">
        <Text style={styles.paragraph}>{report.interpretation}</Text>
        <Text style={styles.sectionBanner}>AI Textual Review</Text>
        <Text style={styles.paragraph}>{report.aiReview.opinion}</Text>
        <Text style={styles.paragraph}>{report.aiReview.assessment}</Text>
      </ReportPage>

      <ReportPage title="Part 3 - Counter-Argument And Assessment">
        <Text style={styles.sectionBanner}>Counter-Argument</Text>
        <Text style={styles.paragraph}>{report.counterArgument}</Text>
        <Text style={styles.paragraph}>{report.aiReview.counterArgument}</Text>
        <Text style={styles.sectionBanner}>Which Argument Holds Most Water</Text>
        <Text style={styles.paragraph}>{report.assessment}</Text>
      </ReportPage>

      {includeVivaQuestions && report.vivaQuestions.length > 0 ? (
        <ReportPage title="Part 4 - Viva Questions">
          {report.vivaQuestions.map((question, index) => (
            <View style={styles.question} key={`${question.question}-${index}`} wrap={false}>
              <Text style={styles.questionText}>
                {index + 1}. {question.question}
              </Text>
              <Text style={styles.muted}>{question.rationale}</Text>
            </View>
          ))}
        </ReportPage>
      ) : null}
    </Document>
  );
}

function ReportPage({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.title}>{title}</Text>
      {children}
      <View style={styles.footer} fixed>
        <Text>LAISR Academic Integrity Signal Review · Confidential</Text>
        <Text render={({ pageNumber }) => `Page ${pageNumber}`} />
      </View>
    </Page>
  );
}

function SummaryGrid({ report }: { report: LaisrReport }) {
  return (
    <View style={styles.summaryGrid}>
      <SummaryBox label="Recommendation" value={report.summary.recommendation} />
      <SummaryBox label="Serious/Critical" value={String(report.summary.seriousCount)} />
      <SummaryBox label="Notable" value={String(report.summary.notableCount)} />
    </View>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function MetadataRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <View style={styles.metaGrid}>
      {rows.map(([label, value], index) => (
        <View style={[styles.metaRow, index === rows.length - 1 ? styles.lastMetaRow : {}]} key={label}>
          <Text style={styles.metaLabel}>{label}</Text>
          <Text style={styles.metaValue}>{value || "N/A"}</Text>
        </View>
      ))}
    </View>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const colour = severityColour(finding.severity);
  const background = severityBackground(finding.severity);

  return (
    <View style={[styles.finding, { borderLeftColor: colour, backgroundColor: background }]}>
      <Text style={[styles.findingTitle, { color: colour }]}>
        {finding.severity.toUpperCase()} · {finding.title}
      </Text>
      <Text style={styles.findingText}>{finding.evidence}</Text>
      {finding.normalRange ? (
        <>
          <Text style={styles.findingSubhead}>Normal range / benchmark</Text>
          <Text style={styles.findingText}>{finding.normalRange}</Text>
        </>
      ) : null}
      <Text style={styles.findingSubhead}>Interpretation</Text>
      <Text style={styles.findingText}>{finding.interpretation}</Text>
      <Text style={styles.findingSubhead}>Counter-argument</Text>
      <Text style={styles.findingText}>{finding.counterArgument}</Text>
      <Text style={styles.findingSubhead}>Viva angle</Text>
      <Text style={styles.findingText}>{finding.vivaAngle}</Text>
    </View>
  );
}

function groupFindings(findings: Finding[]) {
  return findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    groups[finding.category] = groups[finding.category] ?? [];
    groups[finding.category].push(finding);
    return groups;
  }, {});
}

function recommendationColour(recommendation: string) {
  if (recommendation.includes("Strong")) {
    return colours.red;
  }
  if (recommendation.includes("Viva")) {
    return colours.amber;
  }
  if (recommendation.includes("review")) {
    return colours.blue;
  }
  return colours.green;
}

function severityColour(severity: Finding["severity"]) {
  if (severity === "critical" || severity === "serious") {
    return colours.red;
  }
  if (severity === "notable") {
    return colours.amber;
  }
  return colours.blue;
}

function severityBackground(severity: Finding["severity"]) {
  if (severity === "critical" || severity === "serious") {
    return colours.redBg;
  }
  if (severity === "notable") {
    return colours.amberBg;
  }
  return colours.blueBg;
}
