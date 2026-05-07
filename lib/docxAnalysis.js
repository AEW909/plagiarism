import JSZip from 'jszip';

const ARTEFACT_PATTERNS = [
  { key: 'webkit_font', label: '-webkit-standard font marker', pattern: /-webkit-standard/i },
  { key: 'google_docs_hint', label: 'Google Docs/browser paste hint', pattern: /docs-internal-guid|Google Docs/i },
  { key: 'mso_html_fragment', label: 'Microsoft HTML paste fragment', pattern: /MsoNormal|<!--StartFragment-->/i },
];

const DISCOURSE_MARKERS = ['however', 'therefore', 'moreover', 'consequently', 'in contrast', 'furthermore'];
const EVIDENCE_TAGS = {
  CODE: 'CODE-VERIFIED',
  STAT: 'STATISTICAL',
  REVIEW: 'REQUIRES HUMAN REVIEW',
};

function extractXmlTag(xml, tagName) {
  const escapedTag = tagName.replace(':', '\\:');
  const match = xml.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`));
  return match ? decodeXmlEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

async function readZipText(zip, path) {
  const file = zip.file(path);
  return file ? file.async('text') : '';
}

export async function readDocxFile(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  return {
    fileName: file.name,
    coreXml: await readZipText(zip, 'docProps/core.xml'),
    appXml: await readZipText(zip, 'docProps/app.xml'),
    documentXml: await readZipText(zip, 'word/document.xml'),
    stylesXml: await readZipText(zip, 'word/styles.xml'),
    fontXml: await readZipText(zip, 'word/fontTable.xml'),
  };
}

export function extractMetadata({ coreXml, appXml }) {
  const metadata = {};
  const coreFields = {
    creator: 'dc:creator',
    lastModifiedBy: 'cp:lastModifiedBy',
    created: 'dcterms:created',
    modified: 'dcterms:modified',
  };

  for (const [key, tagName] of Object.entries(coreFields)) {
    const text = extractXmlTag(coreXml || '', tagName);
    if (text) metadata[key] = text;
  }

  for (const key of ['Application', 'TotalTime', 'Words', 'Characters', 'Pages', 'Paragraphs']) {
    const text = extractXmlTag(appXml || '', key);
    if (text) metadata[key.toLowerCase()] = text;
  }

  return metadata;
}

export function extractParagraphs(documentXml) {
  if (!documentXml) return [];
  const paragraphMatches = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  return paragraphMatches
    .map((paragraphXml) => {
      const textMatches = [...paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
      return textMatches.map((match) => decodeXmlEntities(match[1])).join('').trim();
    })
    .filter(Boolean);
}

export function computeMetrics(paragraphs) {
  return paragraphs.map((text, index) => {
    const words = text.match(/\b\w+\b/g) || [];
    const sentences = text.split(/[.!?]+/).filter((part) => part.trim());
    const sentenceCount = Math.max(1, sentences.length);
    const passiveHits = text.match(/\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/gi) || [];
    const lower = text.toLowerCase();

    return {
      index: index + 1,
      text,
      wordCount: words.length,
      sentenceCount,
      avgSentenceLength: words.length / sentenceCount,
      passiveRatio: passiveHits.length / sentenceCount,
      markerCount: DISCOURSE_MARKERS.filter((marker) => lower.includes(marker)).length,
    };
  });
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

export function scanXmlArtefacts(docxData) {
  const blobs = {
    documentXml: docxData.documentXml,
    stylesXml: docxData.stylesXml,
    fontXml: docxData.fontXml,
  };
  const findings = [];

  for (const artefact of ARTEFACT_PATTERNS) {
    const locations = Object.entries(blobs)
      .filter(([, text]) => text && artefact.pattern.test(text))
      .map(([name]) => name);

    if (locations.length) {
      findings.push({
        title: `Artefact matched: ${artefact.label}`,
        details: `Pattern found in: ${locations.join(', ')}. This can indicate text or formatting came from an external editor/browser, but it does not prove AI use.`,
        tags: [EVIDENCE_TAGS.CODE, EVIDENCE_TAGS.REVIEW],
      });
    }
  }

  const documentXml = docxData.documentXml || '';
  const hiddenCount = (documentXml.match(/w:vanish/g) || []).length;
  const whiteCount = (documentXml.match(/w:color\s+w:val="(?:FFFFFF|ffffff)"/g) || []).length;

  if (hiddenCount) {
    findings.push({
      title: 'Hidden text formatting detected',
      details: `Found ${hiddenCount} hidden text marker(s), which should be checked manually.`,
      tags: [EVIDENCE_TAGS.CODE, EVIDENCE_TAGS.REVIEW],
    });
  }

  if (whiteCount) {
    findings.push({
      title: 'White text runs detected',
      details: `Found ${whiteCount} explicit white text run(s), which should be checked manually.`,
      tags: [EVIDENCE_TAGS.CODE, EVIDENCE_TAGS.REVIEW],
    });
  }

  return findings;
}

export function findOutlierParagraphs(metrics, zThreshold = 1.6) {
  if (metrics.length < 4) return [];
  const fields = [
    ['avgSentenceLength', 'average sentence length'],
    ['passiveRatio', 'passive voice heuristic'],
    ['markerCount', 'discourse marker count'],
  ];
  const findings = [];

  for (const [field, label] of fields) {
    const values = metrics.map((metric) => Number(metric[field]));
    const avg = mean(values);
    const sd = stdev(values);
    if (!sd) continue;

    for (const metric of metrics) {
      const value = Number(metric[field]);
      const zScore = (value - avg) / sd;
      if (Math.abs(zScore) >= zThreshold) {
        findings.push({
          title: `Paragraph ${metric.index} outlier on ${label}`,
          details: `Value ${value.toFixed(2)} differs from document mean ${avg.toFixed(2)} (z-score ${zScore.toFixed(2)}). Preview: “${metric.text.slice(0, 160)}”`,
          tags: [EVIDENCE_TAGS.STAT, EVIDENCE_TAGS.REVIEW],
        });
      }
    }
  }

  return findings;
}

export function compareToBaseline(submittedMetrics, baselineMetrics) {
  if (!submittedMetrics.length || !baselineMetrics.length) return [];

  const aggregate = (metrics) => ({
    avgSentenceLength: mean(metrics.map((metric) => metric.avgSentenceLength)),
    passiveRatio: mean(metrics.map((metric) => metric.passiveRatio)),
    markerCount: mean(metrics.map((metric) => metric.markerCount)),
    wordCount: mean(metrics.map((metric) => metric.wordCount)),
  });

  const submitted = aggregate(submittedMetrics);
  const baseline = aggregate(baselineMetrics);
  const findings = [];

  for (const key of Object.keys(submitted)) {
    if (!baseline[key]) continue;
    const deltaPercent = ((submitted[key] - baseline[key]) / baseline[key]) * 100;
    if (Math.abs(deltaPercent) >= 25) {
      findings.push({
        title: `Baseline mismatch on ${key}`,
        details: `Submitted value ${submitted[key].toFixed(2)} vs baseline ${baseline[key].toFixed(2)} (delta ${deltaPercent.toFixed(1)}%).`,
        tags: [EVIDENCE_TAGS.STAT, EVIDENCE_TAGS.REVIEW],
      });
    }
  }

  return findings;
}

export function concernLevel(findings) {
  const weightedFindings = findings.filter(
    (finding) => finding.tags.includes(EVIDENCE_TAGS.CODE) || finding.tags.includes(EVIDENCE_TAGS.STAT),
  ).length;

  if (weightedFindings >= 8) return 'High concern — viva recommended';
  if (weightedFindings >= 4) return 'Moderate concern — review suggested';
  if (weightedFindings > 0) return 'Low concern — contextual review suggested';
  return 'No major concern';
}

export function renderMarkdownReport({ submittedName, metadata, findings, paragraphCount }) {
  const lines = [
    '# Viva Trigger Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Document: \`${submittedName}\``,
    '',
    '## Summary judgement',
    `**${concernLevel(findings)}**`,
    '',
    '## Metadata snapshot',
  ];

  if (Object.keys(metadata).length) {
    for (const key of Object.keys(metadata).sort()) lines.push(`- **${key}**: ${metadata[key]}`);
  } else {
    lines.push('- No metadata extracted.');
  }

  lines.push(
    '',
    '## Analysis scope',
    `- Paragraphs analysed: ${paragraphCount}`,
    '- Evidence tags: `CODE-VERIFIED`, `STATISTICAL`, `AI-ASSISTED INTERPRETATION`, `REQUIRES HUMAN REVIEW`',
    '',
    '## Findings',
  );

  if (findings.length) {
    for (const finding of findings) {
      lines.push('', `### ${finding.title}`, `- Details: ${finding.details}`, `- Tags: ${finding.tags.join(', ')}`);
    }
  } else {
    lines.push('No anomaly findings were generated.');
  }

  lines.push(
    '',
    '## Suggested viva prompts',
    '- Can you walk me through how you developed the flagged paragraph(s)?',
    '- What notes or draft materials informed these sections?',
    '- Why did you choose the phrasing and structure in the highlighted section(s)?',
    '',
    '## Caution',
    'This report supports authentication review only and does **not** prove AI use or malpractice.',
  );

  return `${lines.join('\n')}\n`;
}

export async function analyseDocx({ submittedFile, baselineFiles = [] }) {
  const submittedData = await readDocxFile(submittedFile);
  const metadata = extractMetadata(submittedData);
  const paragraphs = extractParagraphs(submittedData.documentXml);
  const submittedMetrics = computeMetrics(paragraphs);
  const findings = [...scanXmlArtefacts(submittedData), ...findOutlierParagraphs(submittedMetrics)];
  const baselineMetrics = [];

  for (const file of baselineFiles) {
    const baselineData = await readDocxFile(file);
    baselineMetrics.push(...computeMetrics(extractParagraphs(baselineData.documentXml)));
  }

  findings.push(...compareToBaseline(submittedMetrics, baselineMetrics));

  return {
    submittedName: submittedFile.name,
    metadata,
    paragraphs,
    metrics: submittedMetrics,
    findings,
    level: concernLevel(findings),
    markdown: renderMarkdownReport({
      submittedName: submittedFile.name,
      metadata,
      findings,
      paragraphCount: paragraphs.length,
    }),
  };
}
