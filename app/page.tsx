"use client";

import {
  AlertTriangle,
  BarChart3,
  Clipboard,
  FileSearch,
  Gauge,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import { analyzePlagiarism } from "@/lib/plagiarism-analysis";

const sampleCandidate = `The expansion of remote work has changed how teams communicate. Employees now rely on asynchronous tools to coordinate projects, document decisions, and reduce unnecessary meetings. This shift can improve focus, but it also requires clearer writing and more deliberate management habits.`;

const sampleSource = `Remote work has transformed the way teams communicate. Workers increasingly depend on asynchronous tools to coordinate projects, record decisions, and avoid unnecessary meetings. The change can improve focus, although it demands clearer writing and intentional management practices.`;

export default function Home() {
  const [candidateText, setCandidateText] = useState("");
  const [sourceText, setSourceText] = useState("");

  const canAnalyze = candidateText.trim().length > 0 && sourceText.trim().length > 0;
  const result = useMemo(
    () => (canAnalyze ? analyzePlagiarism(candidateText, sourceText) : null),
    [candidateText, sourceText, canAnalyze]
  );

  const loadSample = () => {
    setCandidateText(sampleCandidate);
    setSourceText(sampleSource);
  };

  const reset = () => {
    setCandidateText("");
    setSourceText("");
  };

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            <FileSearch size={16} />
            Plagiarism review workspace
          </p>
          <h1>Compare writing and surface plagiarism signals.</h1>
          <p className="lede">
            Paste a submission beside a possible source to inspect phrase overlap,
            sentence similarity, vocabulary reuse, and writing-style shifts.
          </p>
        </div>
        <div className="hero-actions" aria-label="Workspace actions">
          <button className="icon-button" type="button" onClick={loadSample} title="Load sample">
            <Sparkles size={18} />
          </button>
          <button className="icon-button" type="button" onClick={reset} title="Reset texts">
            <RotateCcw size={18} />
          </button>
        </div>
      </section>

      <section className="workspace" aria-label="Document comparison">
        <TextPanel
          label="Candidate text"
          placeholder="Paste the submitted text here..."
          value={candidateText}
          onChange={setCandidateText}
        />
        <TextPanel
          label="Possible source"
          placeholder="Paste a source text, article excerpt, or reference document here..."
          value={sourceText}
          onChange={setSourceText}
        />
      </section>

      {result ? (
        <section className="results" aria-label="Analysis results">
          <div className={`score-panel ${result.verdict.toLowerCase()}`}>
            <div>
              <p className="eyebrow">
                <Gauge size={16} />
                Overall signal
              </p>
              <strong>{result.overallScore}%</strong>
              <span>{result.verdict} concern</span>
            </div>
          </div>

          <div className="metric-grid">
            <Metric label="Lexical similarity" value={result.lexicalSimilarity} />
            <Metric label="Phrase overlap" value={result.phraseOverlap} />
            <Metric label="Sentence similarity" value={result.sentenceSimilarity} />
            <Metric label="Style shift" value={result.styleShift} inverted />
          </div>

          <div className="insight-grid">
            <article className="panel">
              <h2>
                <AlertTriangle size={18} />
                Review notes
              </h2>
              <ul className="notes">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h2>
                <Clipboard size={18} />
                Shared phrases
              </h2>
              {result.sharedPhrases.length > 0 ? (
                <div className="phrase-list">
                  {result.sharedPhrases.map((phrase) => (
                    <span key={phrase.phrase}>
                      {phrase.phrase}
                      {phrase.count > 1 ? ` x${phrase.count}` : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No exact five-word phrase overlap found.</p>
              )}
            </article>
          </div>

          <article className="panel matches">
            <h2>
              <BarChart3 size={18} />
              Strongest sentence matches
            </h2>
            {result.sentenceMatches.length > 0 ? (
              result.sentenceMatches.map((match) => (
                <div className="match" key={`${match.candidate}-${match.source}`}>
                  <div className="match-score">{match.score}%</div>
                  <p>{match.candidate}</p>
                  <p>{match.source}</p>
                </div>
              ))
            ) : (
              <p className="muted">No sentence-level match crossed the review threshold.</p>
            )}
          </article>
        </section>
      ) : (
        <section className="empty-state">
          <FileSearch size={28} />
          <p>Add both texts to generate a report.</p>
        </section>
      )}
    </main>
  );
}

function TextPanel({
  label,
  placeholder,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <label className="text-panel">
      <span>
        {label}
        <small>{wordCount} words</small>
      </span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  inverted = false
}: {
  label: string;
  value: number;
  inverted?: boolean;
}) {
  const displayValue = Math.round(value);

  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{displayValue}%</strong>
      <div className="meter" aria-hidden="true">
        <div
          className={inverted ? "meter-fill inverted" : "meter-fill"}
          style={{ width: `${Math.min(100, displayValue)}%` }}
        />
      </div>
    </div>
  );
}
