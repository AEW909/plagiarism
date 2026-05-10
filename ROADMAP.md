# LAISR Roadmap

## Working Name

**LAISR: Learning Authorship Integrity Signal Review**

LAISR is an academic integrity review tool for examiners and moderators. It gathers multiple forms of evidence from a submitted document, helps interpret those signals, presents plausible counter-arguments, and supports a fair decision about whether a viva is warranted. Its scope is broader than AI detection: it should help review possible direct copying, close paraphrasing, source patchwriting, undisclosed assistance, contract-cheating/process concerns, AI-assisted writing, and authorship inconsistency.

The tool must not accuse a candidate of misconduct. Its purpose is to identify authorship and integrity indicators, prepare evidence-linked viva questions, and give candidates a fair opportunity to demonstrate ownership of their work.

## Product Principle

LAISR should use cautious, review-oriented language:

- "Indicators may warrant examiner review."
- "This finding is consistent with several possible explanations."
- "A viva may help establish authorship, understanding, and process evidence."

LAISR should avoid definitive claims such as:

- "This student cheated."
- "This essay was AI-written."
- "This document proves plagiarism."

## Review Model

Each report should follow a four-stage reasoning model.

### A. Evidence Collection

Collect observable signals from independent sources:

- DOCX metadata
- Word XML forensics
- hidden or white text
- browser-origin fonts and pasted formatting
- revision, RSID, and tracked-change signals
- textual anomalies and copy artefacts
- stylometric repetition and paragraph similarity
- linguistic and register consistency
- comparison with authenticated student work
- text-only AI review covering source-use, authorship, close paraphrase, plagiarism, AI-writing, and undisclosed assistance indicators
- future online/source-index matching for passages where exact or close copying is suspected

This layer should be factual and concrete.

### B. Interpretation

Explain what the evidence may suggest. AI can help synthesise patterns across the document, especially where several weak signals cluster in the same section.

Interpretation must remain probabilistic and cautious.

### C. Counter-Argument

For each concerning interpretation, present plausible innocent explanations. Examples include shared devices, school templates, Word Online, Google Docs, grammar tools, heavy revision, legitimate quotation, teacher-provided phrasing, or natural stylistic development.

### D. Assessment

Assess which explanation best fits the combined evidence:

- strength of the concerning interpretation
- credibility of innocent explanations
- number of independent indicators
- whether indicators cluster in the same sections
- comparison with authenticated work
- whether the issue can be tested fairly in viva

The output should be a moderation recommendation, not a misconduct verdict.

## Core Build

### 1. DOCX Uploader

Build a Vercel-ready upload workflow:

- drag-and-drop `.docx` upload
- candidate ID and subject fields
- file validation
- document text extraction
- raw DOCX XML extraction
- no persistence required for the first version

### 2. Algorithmic Analysis

Implement deterministic analyzers for:

- metadata
- XML forensics
- hidden text
- browser-origin fonts
- RSID distribution
- tracked changes
- font diversity
- suspicious substitutions
- grammar and copy artefacts
- compound word merging
- transition phrase density
- repeated key phrases
- near-duplicate paragraphs
- circular restatement
- sentence-opening patterns
- readability and register consistency

All findings should be returned as structured JSON with category, severity, title, evidence, location, interpretation, counter-argument, and viva angle.

### 3. AI Analysis

AI should operate in two distinct stages. The first stage is a named text-only evidence stream alongside algorithmic findings. The second stage synthesises that text-only opinion with metadata, XML, stylometric, linguistic, authenticated-writing, and source-use evidence. It should not be framed as an "AI detector"; it should help review source-use, authorship, drafting-process, and malpractice indicators.

AI stage 1 task:

- assess only the submitted text for prose features associated with direct copying, close paraphrase, source patchwriting, AI-assisted drafting, or authorship inconsistency
- return a cautious concern level without seeing metadata, XML, stylometrics, or deterministic findings

AI stage 2 tasks:

- synthesise findings across modules
- generate cautious interpretations
- generate counter-arguments
- generate evidence-linked viva questions

AI must not produce a standalone misconduct conclusion.

### 3a. Online Source Matching

LAISR should eventually check whether high-concern passages appear online or in supplied source materials.

Possible approach:

- support Google Custom Search JSON API / Programmable Search Engine as an optional first provider
- use `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` environment variables
- extract candidate passages from high-complexity, high-formality, near-duplicate, or source-like sections
- search short distinctive snippets rather than whole paragraphs
- record exact source URLs, titles, dates accessed, and matched wording
- separate exact copying from close paraphrase and common phrasing
- avoid sending sensitive student work to broad search APIs without consent and retention controls

This will require either a web search API, an academic/source index, or teacher-supplied source corpora. Until then, LAISR should say "source-like" or "worth checking", not "found online".

### 4. Comparison With Authenticated Work

Allow examiners to upload known student work for comparison.

Compare:

- complexity
- vocabulary
- register
- sentence length
- paragraph structure
- transition usage
- terminology

This supports fairer authorship review because it compares the submission with the candidate's own known writing.

Initial implementation now supports one optional authenticated `.docx` sample and compares readability, sentence length, vocabulary range, formal/informal register, transition density, and sentence-opening patterns. Future work should support a library of authenticated samples and show change over time.

### 5. Review And Recommendations

Provide a dashboard and report with outcome bands:

- No significant indicators detected
- Indicators present, but innocent explanations are plausible
- Examiner review recommended
- Viva recommended
- Strong viva recommended due to clustered independent indicators

### 6. PDF Download

Generate a professional PDF report:

- cover and executive summary
- evidence findings
- interpretation
- counter-arguments
- assessment
- viva recommendation
- suggested viva questions
- candidate opportunity section

## Future Ideas

### Class Set Review

Support multiple file upload for a whole class set:

- batch analysis
- per-candidate review cards
- sortable signal ranking
- cohort outlier detection
- similarity between submissions
- RSID genealogy analysis, including shared `rsidRoot` values that may indicate submissions cloned from the same parent document or template
- cross-document RSID/session-pattern comparison to distinguish common school templates from unusual shared provenance
- optional teacher-provided context

Teacher ranking or expectation data must be handled carefully as context, not evidence.

### Supabase Integration

Add Supabase when the product needs persistence:

- examiner login
- school or department accounts
- saved reports
- uploaded document storage
- authenticated work libraries
- audit trails
- retention and deletion controls
- role-based access

Likely tables:

- organisations
- users
- candidates
- submissions
- authenticated_samples
- analysis_reports
- findings
- viva_questions

Likely storage buckets:

- submissions
- authenticated-work
- generated-reports

## Build Order

1. Convert the current app to DOCX upload and extraction.
2. Build the algorithmic findings engine.
3. Add the review dashboard.
4. Add AI-assisted interpretation and viva questions.
5. Add PDF export.
6. Add authenticated work comparison. **Initial single-sample version complete.**
7. Add Supabase persistence.
8. Add class-set analysis.

Keep this roadmap updated as the product direction evolves.
