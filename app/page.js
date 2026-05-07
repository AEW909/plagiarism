'use client';

import { useMemo, useState } from 'react';
import { analyseDocx } from '../lib/docxAnalysis';

function Tags({ tags }) {
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          {tag}
        </span>
      ))}
    </div>
  );
}

function downloadMarkdown(report, fileName = 'viva_report.md') {
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [submittedFile, setSubmittedFile] = useState(null);
  const [baselineFiles, setBaselineFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);

  const baselineLabel = useMemo(() => {
    if (!baselineFiles.length) return 'No baseline files selected';
    return baselineFiles.map((file) => file.name).join(', ');
  }, [baselineFiles]);

  async function runAnalysis(event) {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!submittedFile) {
      setError('Please choose a submitted .docx file first.');
      return;
    }

    setIsAnalysing(true);
    try {
      const analysis = await analyseDocx({ submittedFile, baselineFiles });
      setResult(analysis);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Could not analyse the document.');
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">DOCX authentication-support screening</p>
          <h1>Viva Trigger Report Generator</h1>
          <p className="lede">
            Upload a submitted Word document, optionally add authenticated baseline work, and generate a teacher-facing report for follow-up review.
            Files are processed in your browser and are not uploaded to a server by this app.
          </p>
        </div>
        <div className="caution-card">
          <strong>Not an AI detector</strong>
          <span>This tool surfaces metadata, XML artefacts, and statistical anomalies. It supports questions, not accusations.</span>
        </div>
      </section>

      <form className="panel form-panel" onSubmit={runAnalysis}>
        <label className="file-picker">
          <span>Submitted DOCX</span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setSubmittedFile(event.target.files?.[0] || null)}
          />
          <small>{submittedFile ? submittedFile.name : 'Choose the document to analyse'}</small>
        </label>

        <label className="file-picker">
          <span>Authenticated baseline DOCX files (optional)</span>
          <input
            type="file"
            multiple
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setBaselineFiles(Array.from(event.target.files || []))}
          />
          <small>{baselineLabel}</small>
        </label>

        <button className="primary-button" type="submit" disabled={isAnalysing}>
          {isAnalysing ? 'Analysing…' : 'Generate report'}
        </button>

        {error ? <p className="error-message">{error}</p> : null}
      </form>

      {result ? (
        <section className="results-grid">
          <div className="panel summary-panel">
            <p className="eyebrow">Summary judgement</p>
            <h2>{result.level}</h2>
            <dl>
              <div>
                <dt>Document</dt>
                <dd>{result.submittedName}</dd>
              </div>
              <div>
                <dt>Paragraphs analysed</dt>
                <dd>{result.paragraphs.length}</dd>
              </div>
              <div>
                <dt>Findings</dt>
                <dd>{result.findings.length}</dd>
              </div>
            </dl>
            <button className="secondary-button" type="button" onClick={() => downloadMarkdown(result.markdown)}>
              Download Markdown report
            </button>
          </div>

          <div className="panel">
            <h2>Metadata snapshot</h2>
            {Object.keys(result.metadata).length ? (
              <dl className="metadata-list">
                {Object.entries(result.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No metadata was extracted.</p>
            )}
          </div>

          <div className="panel findings-panel">
            <h2>Findings</h2>
            {result.findings.length ? (
              result.findings.map((finding, index) => (
                <article key={`${finding.title}-${index}`} className="finding-card">
                  <h3>{finding.title}</h3>
                  <p>{finding.details}</p>
                  <Tags tags={finding.tags} />
                </article>
              ))
            ) : (
              <p>No anomaly findings were generated.</p>
            )}
          </div>

          <div className="panel viva-panel">
            <h2>Suggested viva prompts</h2>
            <ul>
              <li>Can you walk me through how you developed the flagged paragraph(s)?</li>
              <li>What notes or draft materials informed these sections?</li>
              <li>Why did you choose the phrasing and structure in the highlighted section(s)?</li>
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
