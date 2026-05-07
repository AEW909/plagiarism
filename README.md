# LAISR

**Learning Authorship Integrity Signal Review**

A Vercel-ready Next.js app for collecting academic integrity review signals from `.docx` submissions. LAISR is designed to support examiner judgment and viva preparation, not to accuse candidates or prove misconduct.

The app currently analyses:

- DOCX metadata
- raw Word XML signals
- hidden text and browser-origin font markers
- textual anomalies and copy artefacts
- stylometric repetition
- linguistic/register shifts
- optional AI-assisted interpretation and viva question generation

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional AI review

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.

The AI layer is interpretive. It sits alongside algorithmic evidence and should be read as one review stream, not a standalone detector.

## Deploying to Vercel

Import this repository in Vercel and deploy it as a Next.js project. Add `OPENAI_API_KEY` in Vercel only when you want AI-assisted interpretation enabled.

## When Supabase becomes useful

Add Supabase when you want any of these:

- user accounts and report history
- uploaded document storage
- a reusable comparison corpus
- team review queues
- audit trails for academic workflows
