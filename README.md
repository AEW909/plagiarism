# LAISR

**Learning Authorship Integrity Signal Review**

A Vercel-ready Next.js app for collecting academic integrity review signals from `.docx` submissions. LAISR is designed to support examiner judgment and viva preparation across possible plagiarism, close paraphrasing, undisclosed assistance, contract-cheating/process concerns, AI-assisted writing, and authorship inconsistency. It does not accuse candidates or prove misconduct.

The app currently analyses:

- DOCX metadata
- raw Word XML signals
- hidden text and browser-origin font markers
- textual anomalies and copy artefacts
- stylometric repetition
- linguistic/register shifts
- optional two-stage AI review: a text-only malpractice opinion first, followed by a synthesis call that weighs that opinion alongside forensic findings and can generate viva questions

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional AI review

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.

The AI layer has two stages. Stage 1 is a text-only review: the model sees the submitted writing but not the DOCX metadata, XML, stylometric checks, or other deterministic findings. Stage 2 is synthesis: the model weighs the text-only review alongside the forensic evidence and produces interpretation, counter-argument, final weighing, and viva prompts where appropriate. It should be read as review support, not a standalone detector for AI, plagiarism, or malpractice.

## Online source matching

LAISR can currently flag source-like passages, copy/paste artefacts, and sections that may warrant source questioning. It does **not** yet run a live web or academic-index search. True online matching would need a search provider or plagiarism-index integration, careful quotation handling, and clear reporting of exact source hits.

## Deploying to Vercel

Import this repository in Vercel and deploy it as a Next.js project. Add `OPENAI_API_KEY` in Vercel only when you want AI-assisted interpretation enabled.

## When Supabase becomes useful

Add Supabase when you want any of these:

- user accounts and report history
- uploaded document storage
- a reusable comparison corpus
- team review queues
- audit trails for academic workflows
