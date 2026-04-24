# DOCX Viva Trigger Report Generator

This repository provides a Python prototype for screening DOCX submissions and generating a **viva trigger report**.

## Purpose

The tool is designed for **authentication support**, not AI detection. It can help identify reasons a teacher might reasonably investigate further.

## What it does

- Extracts DOCX metadata from `docProps/core.xml` and `docProps/app.xml`.
- Scans WordprocessingML for potential copy/paste artefacts (e.g., `-webkit-standard`, hidden/white text markers).
- Computes paragraph-level statistics (sentence length, passive-voice heuristic, discourse marker density).
- Flags intra-document outlier paragraphs.
- Optionally compares the submitted document against authenticated baseline DOCX files.
- Produces a Markdown report with evidence tags:
  - `CODE-VERIFIED`
  - `STATISTICAL`
  - `AI-ASSISTED INTERPRETATION`
  - `REQUIRES HUMAN REVIEW`

## Usage

```bash
python3 docx_viva_trigger.py submitted.docx --baseline baseline1.docx baseline2.docx --output viva_report.md
```

## Important caution

- This tool does **not** prove AI use or malpractice.
- Findings should be used to guide follow-up checks (e.g., viva, notes/draft review, process questioning).
