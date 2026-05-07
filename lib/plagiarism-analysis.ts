export type SentenceMatch = {
  candidate: string;
  source: string;
  score: number;
};

export type SharedPhrase = {
  phrase: string;
  count: number;
};

export type StyleProfile = {
  averageSentenceLength: number;
  averageWordLength: number;
  vocabularyRichness: number;
  punctuationDensity: number;
};

export type AnalysisResult = {
  overallScore: number;
  verdict: "Low" | "Moderate" | "High";
  lexicalSimilarity: number;
  phraseOverlap: number;
  sentenceSimilarity: number;
  styleShift: number;
  sharedPhrases: SharedPhrase[];
  sentenceMatches: SentenceMatch[];
  candidateProfile: StyleProfile;
  sourceProfile: StyleProfile;
  notes: string[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with"
]);

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function analyzePlagiarism(
  candidateText: string,
  sourceText: string
): AnalysisResult {
  const candidateTokens = tokenize(candidateText);
  const sourceTokens = tokenize(sourceText);
  const candidateContent = candidateTokens.filter((token) => !STOP_WORDS.has(token));
  const sourceContent = sourceTokens.filter((token) => !STOP_WORDS.has(token));

  const lexicalSimilarity = jaccard(candidateContent, sourceContent) * 100;
  const sharedPhrases = findSharedPhrases(candidateTokens, sourceTokens, 5);
  const phraseOverlap = scorePhraseOverlap(sharedPhrases, candidateTokens.length);
  const sentenceMatches = findSentenceMatches(candidateText, sourceText);
  const sentenceSimilarity =
    sentenceMatches.length === 0
      ? 0
      : sentenceMatches.reduce((sum, match) => sum + match.score, 0) /
        sentenceMatches.length;

  const candidateProfile = buildStyleProfile(candidateText);
  const sourceProfile = buildStyleProfile(sourceText);
  const styleShift = scoreStyleShift(candidateProfile, sourceProfile);

  const overallScore = clamp(
    lexicalSimilarity * 0.34 +
      phraseOverlap * 0.31 +
      sentenceSimilarity * 0.28 +
      Math.max(0, 100 - styleShift) * 0.07
  );

  return {
    overallScore: round(overallScore),
    verdict: getVerdict(overallScore),
    lexicalSimilarity: round(lexicalSimilarity),
    phraseOverlap: round(phraseOverlap),
    sentenceSimilarity: round(sentenceSimilarity),
    styleShift: round(styleShift),
    sharedPhrases: sharedPhrases.slice(0, 12),
    sentenceMatches: sentenceMatches.slice(0, 8),
    candidateProfile,
    sourceProfile,
    notes: buildNotes({
      lexicalSimilarity,
      phraseOverlap,
      sentenceSimilarity,
      styleShift,
      candidateTokens: candidateTokens.length,
      sourceTokens: sourceTokens.length
    })
  };
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .match(/[a-z0-9]+/g) ?? [];
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function jaccard(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (leftSet.size + rightSet.size - intersection);
}

function findSharedPhrases(
  candidateTokens: string[],
  sourceTokens: string[],
  phraseLength: number
) {
  const sourcePhraseCounts = new Map<string, number>();
  const sharedPhraseCounts = new Map<string, number>();

  for (let index = 0; index <= sourceTokens.length - phraseLength; index += 1) {
    const phrase = sourceTokens.slice(index, index + phraseLength).join(" ");
    sourcePhraseCounts.set(phrase, (sourcePhraseCounts.get(phrase) ?? 0) + 1);
  }

  for (let index = 0; index <= candidateTokens.length - phraseLength; index += 1) {
    const phrase = candidateTokens.slice(index, index + phraseLength).join(" ");
    if (sourcePhraseCounts.has(phrase)) {
      sharedPhraseCounts.set(phrase, (sharedPhraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  return Array.from(sharedPhraseCounts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((left, right) => right.count - left.count || right.phrase.length - left.phrase.length);
}

function scorePhraseOverlap(sharedPhrases: SharedPhrase[], tokenCount: number) {
  if (tokenCount === 0) {
    return 0;
  }

  const overlappedTokens = sharedPhrases.reduce(
    (sum, phrase) => sum + phrase.count * phrase.phrase.split(" ").length,
    0
  );

  return clamp((overlappedTokens / tokenCount) * 160);
}

function findSentenceMatches(candidateText: string, sourceText: string) {
  const candidateSentences = splitSentences(candidateText);
  const sourceSentences = splitSentences(sourceText);
  const matches: SentenceMatch[] = [];

  for (const candidate of candidateSentences) {
    const candidateTokens = tokenize(candidate).filter((token) => !STOP_WORDS.has(token));
    let best: SentenceMatch | null = null;

    for (const source of sourceSentences) {
      const sourceTokens = tokenize(source).filter((token) => !STOP_WORDS.has(token));
      const score = jaccard(candidateTokens, sourceTokens) * 100;

      if (score >= 45 && (!best || score > best.score)) {
        best = {
          candidate,
          source,
          score: round(score)
        };
      }
    }

    if (best) {
      matches.push(best);
    }
  }

  return matches.sort((left, right) => right.score - left.score);
}

function buildStyleProfile(text: string): StyleProfile {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);
  const characters = text.replace(/\s/g, "").length;
  const punctuation = text.match(/[.,;:!?()[\]"]/g)?.length ?? 0;

  return {
    averageSentenceLength: round(tokens.length / Math.max(1, sentences.length)),
    averageWordLength: round(
      tokens.reduce((sum, token) => sum + token.length, 0) / Math.max(1, tokens.length)
    ),
    vocabularyRichness: round((new Set(tokens).size / Math.max(1, tokens.length)) * 100),
    punctuationDensity: round((punctuation / Math.max(1, characters)) * 100, 2)
  };
}

function scoreStyleShift(candidate: StyleProfile, source: StyleProfile) {
  const sentenceDelta =
    Math.abs(candidate.averageSentenceLength - source.averageSentenceLength) /
    Math.max(1, source.averageSentenceLength);
  const wordDelta =
    Math.abs(candidate.averageWordLength - source.averageWordLength) /
    Math.max(1, source.averageWordLength);
  const vocabDelta =
    Math.abs(candidate.vocabularyRichness - source.vocabularyRichness) /
    Math.max(1, source.vocabularyRichness);
  const punctuationDelta =
    Math.abs(candidate.punctuationDensity - source.punctuationDensity) /
    Math.max(1, source.punctuationDensity);

  return clamp((sentenceDelta * 0.35 + wordDelta * 0.2 + vocabDelta * 0.3 + punctuationDelta * 0.15) * 100);
}

function getVerdict(score: number): AnalysisResult["verdict"] {
  if (score >= 68) {
    return "High";
  }

  if (score >= 38) {
    return "Moderate";
  }

  return "Low";
}

function buildNotes({
  lexicalSimilarity,
  phraseOverlap,
  sentenceSimilarity,
  styleShift,
  candidateTokens,
  sourceTokens
}: {
  lexicalSimilarity: number;
  phraseOverlap: number;
  sentenceSimilarity: number;
  styleShift: number;
  candidateTokens: number;
  sourceTokens: number;
}) {
  const notes: string[] = [];

  if (candidateTokens < 80 || sourceTokens < 80) {
    notes.push("Short samples can create unstable scores. Treat this as a directional check.");
  }

  if (phraseOverlap >= 45) {
    notes.push("Several exact multi-word phrases appear in both texts.");
  }

  if (sentenceSimilarity >= 55) {
    notes.push("Some sentences share unusually similar vocabulary and structure.");
  }

  if (lexicalSimilarity >= 35) {
    notes.push("The texts reuse a notable amount of content vocabulary.");
  }

  if (styleShift >= 45) {
    notes.push("The writing profiles differ enough that mixed authorship may be worth reviewing.");
  }

  if (notes.length === 0) {
    notes.push("No strong signal stands out, but this does not rule out paraphrased plagiarism.");
  }

  return notes;
}
