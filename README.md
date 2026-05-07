# DOCX Viva Trigger Report Generator

This repository now includes two versions of the same authentication-support idea:

1. a **Next.js web app** that can be deployed to Vercel; and
2. the original **Python CLI/desktop prototype**.

The tool is designed for **authentication support**, not AI detection. It can help identify reasons a teacher might reasonably investigate further, such as metadata/XML artefacts, copy/paste indicators, intra-document paragraph anomalies, or differences from authenticated baseline work.

## Next.js / Vercel app

The deployable web app lives in `app/` and `lib/`.

### What the web app does

- Runs DOCX analysis in the browser using JavaScript.
- Does not upload documents to an application server.
- Extracts DOCX metadata from `docProps/core.xml` and `docProps/app.xml`.
- Scans WordprocessingML for potential copy/paste artefacts (for example `-webkit-standard`, hidden text, and white text markers).
- Computes paragraph-level statistics, including average sentence length, passive-voice heuristic, and discourse marker density.
- Flags intra-document outlier paragraphs.
- Optionally compares the submitted document against authenticated baseline DOCX files.
- Shows findings in the UI and lets the user download a Markdown viva report.

### Run locally

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually `http://localhost:3000`.

### Deploy to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Create a new Vercel project from the repository.
3. Use the default Next.js settings.
4. Deploy.

No special environment variables are required because the current app performs analysis client-side.

## Python prototype

The Python version remains available as `docx_viva_trigger.py`.

### GUI mode

```bash
python3 docx_viva_trigger.py --gui
```

If you run `python3 docx_viva_trigger.py` with no arguments, it opens the same UI.

### Command-line mode

```bash
python3 docx_viva_trigger.py submitted.docx --baseline baseline1.docx baseline2.docx --output viva_report.md
```

## Output location

- In the Next.js app, use **Download Markdown report** after generating a report.
- In Python command-line mode, output is written to `viva_report.md` in your current working directory unless you pass `--output`.
- In Python GUI mode, choose the output path with **Save as…**.

## Important caution

- This tool does **not** prove AI use or malpractice.
- Findings should be used to guide follow-up checks, such as viva, notes/draft review, and process questioning.
