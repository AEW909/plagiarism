#!/usr/bin/env python3
"""Viva Trigger Report Generator for DOCX authentication support.

This tool is intentionally NOT an AI detector. It gathers:
- CODE-VERIFIED findings from DOCX metadata/XML
- STATISTICAL findings from paragraph-level text features
- optional baseline mismatch indicators

Outputs a Markdown report suitable for teacher review.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import statistics
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
import xml.etree.ElementTree as ET

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "dc": "http://purl.org/dc/elements/1.1/",
    "dcterms": "http://purl.org/dc/terms/",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
}

ARTEFACT_PATTERNS = {
    "webkit_font": re.compile(r"-webkit-standard", re.IGNORECASE),
    "google_docs_hint": re.compile(r"docs-internal-guid|Google Docs", re.IGNORECASE),
    "mso_html_fragment": re.compile(r"MsoNormal|<!--StartFragment-->", re.IGNORECASE),
}

DISCOURSE_MARKERS = {"however", "therefore", "moreover", "consequently", "in contrast", "furthermore"}


@dataclass
class Finding:
    title: str
    details: str
    tags: Tuple[str, ...]


@dataclass
class ParagraphMetrics:
    index: int
    text: str
    word_count: int
    sentence_count: int
    avg_sentence_len: float
    passive_ratio: float
    marker_count: int


def read_zip_text(zf: zipfile.ZipFile, path: str) -> Optional[str]:
    try:
        with zf.open(path) as fh:
            return fh.read().decode("utf-8", errors="replace")
    except KeyError:
        return None


def parse_xml(text: Optional[str]) -> Optional[ET.Element]:
    if not text:
        return None
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        return None


def extract_docx_data(docx_path: Path) -> Dict[str, Optional[str]]:
    with zipfile.ZipFile(docx_path) as zf:
        return {
            "core_xml": read_zip_text(zf, "docProps/core.xml"),
            "app_xml": read_zip_text(zf, "docProps/app.xml"),
            "document_xml": read_zip_text(zf, "word/document.xml"),
            "styles_xml": read_zip_text(zf, "word/styles.xml"),
            "font_xml": read_zip_text(zf, "word/fontTable.xml"),
        }


def extract_metadata(core_xml: Optional[str], app_xml: Optional[str]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    core_root = parse_xml(core_xml)
    if core_root is not None:
        for key, xpath in {
            "creator": "dc:creator",
            "last_modified_by": "cp:lastModifiedBy",
            "created": "dcterms:created",
            "modified": "dcterms:modified",
        }.items():
            node = core_root.find(xpath, NS)
            if node is not None and node.text:
                out[key] = node.text

    app_root = parse_xml(app_xml)
    if app_root is not None:
        for node_name in ["Application", "TotalTime", "Words", "Characters", "Pages", "Paragraphs"]:
            node = app_root.find(f".//{{*}}{node_name}")
            if node is not None and node.text:
                out[node_name.lower()] = node.text
    return out


def extract_paragraphs(document_xml: Optional[str]) -> List[str]:
    root = parse_xml(document_xml)
    if root is None:
        return []
    paragraphs: List[str] = []
    for p in root.findall(".//w:p", NS):
        chunks = []
        for t in p.findall(".//w:t", NS):
            if t.text:
                chunks.append(t.text)
        text = "".join(chunks).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def compute_metrics(paragraphs: Iterable[str]) -> List[ParagraphMetrics]:
    metrics: List[ParagraphMetrics] = []
    for i, p in enumerate(paragraphs, start=1):
        words = re.findall(r"\b\w+\b", p)
        sentence_parts = [s for s in re.split(r"[.!?]+", p) if s.strip()]
        word_count = len(words)
        sentence_count = max(1, len(sentence_parts))
        avg_sentence_len = word_count / sentence_count

        passive_hits = len(re.findall(r"\b(?:is|are|was|were|be|been|being)\s+\w+ed\b", p, re.IGNORECASE))
        passive_ratio = passive_hits / max(1, sentence_count)

        lower = p.lower()
        marker_count = sum(1 for m in DISCOURSE_MARKERS if m in lower)

        metrics.append(
            ParagraphMetrics(
                index=i,
                text=p,
                word_count=word_count,
                sentence_count=sentence_count,
                avg_sentence_len=avg_sentence_len,
                passive_ratio=passive_ratio,
                marker_count=marker_count,
            )
        )
    return metrics


def mean_stdev(values: List[float]) -> Tuple[float, float]:
    if not values:
        return 0.0, 0.0
    if len(values) == 1:
        return values[0], 0.0
    return statistics.mean(values), statistics.pstdev(values)


def find_outlier_paragraphs(metrics: List[ParagraphMetrics], z_threshold: float = 1.6) -> List[Finding]:
    if len(metrics) < 4:
        return []

    findings: List[Finding] = []
    features = {
        "avg_sentence_len": [m.avg_sentence_len for m in metrics],
        "passive_ratio": [m.passive_ratio for m in metrics],
        "marker_count": [float(m.marker_count) for m in metrics],
    }

    for feature_name, values in features.items():
        mean, sd = mean_stdev(values)
        if sd == 0:
            continue
        for m in metrics:
            value = getattr(m, feature_name)
            z = (value - mean) / sd
            if abs(z) >= z_threshold:
                findings.append(
                    Finding(
                        title=f"Paragraph {m.index} outlier on {feature_name}",
                        details=(
                            f"Value {value:.2f} differs from document mean {mean:.2f} "
                            f"(z-score {z:.2f}). Text preview: {m.text[:140]!r}"
                        ),
                        tags=("STATISTICAL", "REQUIRES HUMAN REVIEW"),
                    )
                )
    return findings


def scan_xml_artefacts(xml_blobs: Dict[str, Optional[str]]) -> List[Finding]:
    findings: List[Finding] = []

    for name, pattern in ARTEFACT_PATTERNS.items():
        locations = []
        for blob_name, text in xml_blobs.items():
            if text and pattern.search(text):
                locations.append(blob_name)
        if locations:
            findings.append(
                Finding(
                    title=f"Artefact matched: {name}",
                    details=f"Pattern found in: {', '.join(locations)}.",
                    tags=("CODE-VERIFIED", "REQUIRES HUMAN REVIEW"),
                )
            )

    document_xml = xml_blobs.get("document_xml") or ""
    hidden_count = len(re.findall(r"w:vanish", document_xml))
    white_count = len(re.findall(r'w:color\s+w:val="(?:FFFFFF|ffffff)"', document_xml))
    if hidden_count:
        findings.append(
            Finding(
                title="Hidden text formatting detected",
                details=f"Found {hidden_count} hidden text markers (w:vanish) in word/document.xml.",
                tags=("CODE-VERIFIED", "REQUIRES HUMAN REVIEW"),
            )
        )
    if white_count:
        findings.append(
            Finding(
                title="White text runs detected",
                details=f"Found {white_count} explicit white text color runs in word/document.xml.",
                tags=("CODE-VERIFIED", "REQUIRES HUMAN REVIEW"),
            )
        )

    return findings


def compare_to_baseline(submitted: List[ParagraphMetrics], baseline: List[ParagraphMetrics]) -> List[Finding]:
    if not submitted or not baseline:
        return []

    def aggregate(ms: List[ParagraphMetrics]) -> Dict[str, float]:
        return {
            "avg_sentence_len": statistics.mean(m.avg_sentence_len for m in ms),
            "passive_ratio": statistics.mean(m.passive_ratio for m in ms),
            "marker_count": statistics.mean(m.marker_count for m in ms),
            "word_count": statistics.mean(m.word_count for m in ms),
        }

    s = aggregate(submitted)
    b = aggregate(baseline)

    findings: List[Finding] = []
    for key in s:
        base = b[key]
        if base == 0:
            continue
        delta_pct = ((s[key] - base) / base) * 100
        if abs(delta_pct) >= 25:
            findings.append(
                Finding(
                    title=f"Baseline mismatch on {key}",
                    details=f"Submitted value {s[key]:.2f} vs baseline {base:.2f} (delta {delta_pct:+.1f}%).",
                    tags=("STATISTICAL", "REQUIRES HUMAN REVIEW"),
                )
            )
    return findings


def render_report(
    submitted_path: Path,
    metadata: Dict[str, str],
    findings: List[Finding],
    paragraph_count: int,
) -> str:
    now = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    high_weight = sum(1 for f in findings if "CODE-VERIFIED" in f.tags)
    stat_weight = sum(1 for f in findings if "STATISTICAL" in f.tags)

    if high_weight + stat_weight >= 8:
        level = "High concern — viva recommended"
    elif high_weight + stat_weight >= 4:
        level = "Moderate concern — review suggested"
    elif findings:
        level = "Low concern — contextual review suggested"
    else:
        level = "No major concern"

    lines = [
        "# Viva Trigger Report",
        "",
        f"Generated: {now}",
        f"Document: `{submitted_path.name}`",
        "",
        "## Summary judgement",
        f"**{level}**",
        "",
        "## Metadata snapshot",
    ]

    if metadata:
        for k in sorted(metadata):
            lines.append(f"- **{k}**: {metadata[k]}")
    else:
        lines.append("- No metadata extracted.")

    lines.extend(
        [
            "",
            "## Analysis scope",
            f"- Paragraphs analysed: {paragraph_count}",
            "- Evidence tags: `CODE-VERIFIED`, `STATISTICAL`, `AI-ASSISTED INTERPRETATION`, `REQUIRES HUMAN REVIEW`",
            "",
            "## Findings",
        ]
    )

    if findings:
        for f in findings:
            lines.extend(
                [
                    f"### {f.title}",
                    f"- Details: {f.details}",
                    f"- Tags: {', '.join(f.tags)}",
                    "",
                ]
            )
    else:
        lines.append("No anomaly findings were generated.")

    lines.extend(
        [
            "## Suggested viva prompts",
            "- Can you walk me through how you developed the flagged paragraph(s)?",
            "- What notes or draft materials informed these sections?",
            "- Why did you choose the phrasing and structure in the highlighted section(s)?",
            "",
            "## Caution",
            "This report supports authentication review only and does **not** prove AI use or malpractice.",
        ]
    )

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a DOCX viva trigger report.")
    parser.add_argument("submitted", type=Path, help="Submitted DOCX path")
    parser.add_argument(
        "--baseline",
        type=Path,
        nargs="*",
        default=[],
        help="Optional authenticated baseline DOCX files",
    )
    parser.add_argument("--output", type=Path, default=Path("viva_report.md"), help="Markdown output path")
    args = parser.parse_args()

    submitted_blobs = extract_docx_data(args.submitted)
    metadata = extract_metadata(submitted_blobs["core_xml"], submitted_blobs["app_xml"])
    submitted_paragraphs = extract_paragraphs(submitted_blobs["document_xml"])
    submitted_metrics = compute_metrics(submitted_paragraphs)

    findings: List[Finding] = []
    findings.extend(scan_xml_artefacts(submitted_blobs))
    findings.extend(find_outlier_paragraphs(submitted_metrics))

    baseline_metrics: List[ParagraphMetrics] = []
    for base in args.baseline:
        try:
            base_blobs = extract_docx_data(base)
            base_paras = extract_paragraphs(base_blobs["document_xml"])
            baseline_metrics.extend(compute_metrics(base_paras))
        except Exception as exc:
            findings.append(
                Finding(
                    title=f"Baseline read warning: {base.name}",
                    details=f"Could not process baseline file ({exc}).",
                    tags=("REQUIRES HUMAN REVIEW",),
                )
            )

    findings.extend(compare_to_baseline(submitted_metrics, baseline_metrics))

    report = render_report(args.submitted, metadata, findings, len(submitted_paragraphs))
    args.output.write_text(report, encoding="utf-8")
    print(f"Report written to {args.output}")


if __name__ == "__main__":
    main()
