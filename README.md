# Plagiarism Signal Checker

A Vercel-ready Next.js app for detecting signs of plagiarism between two text samples.

The app does not claim to prove plagiarism. It surfaces useful review signals: lexical similarity, phrase overlap, sentence-level matches, vocabulary reuse, and stylometric shifts.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploying to Vercel

Import this repository in Vercel and deploy it as a Next.js project. No environment variables are required for the current local-only analysis flow.

## When Supabase becomes useful

Add Supabase when you want any of these:

- user accounts and report history
- uploaded document storage
- a reusable comparison corpus
- team review queues
- audit trails for academic workflows
