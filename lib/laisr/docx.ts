import JSZip from "jszip";
import mammoth from "mammoth";
import type { DocumentMetadata } from "./types";

export type ExtractedDocx = {
  fileName: string;
  text: string;
  paragraphs: string[];
  documentXml: string;
  coreXml: string;
  appXml: string;
  metadata: DocumentMetadata;
};

const emptyMetadata: DocumentMetadata = {
  creator: "N/A",
  lastModifiedBy: "N/A",
  created: "N/A",
  modified: "N/A",
  revision: "N/A",
  totalTimeMinutes: "N/A",
  wordCount: "N/A",
  pages: "N/A",
  application: "N/A"
};

export async function extractDocx(file: File): Promise<ExtractedDocx> {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Please upload a valid .docx file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file("word/document.xml");

  if (!documentEntry) {
    throw new Error("This file does not contain word/document.xml and does not appear to be a valid .docx document.");
  }

  const [documentXml, coreXml, appXml, mammothResult] = await Promise.all([
    documentEntry.async("text"),
    zip.file("docProps/core.xml")?.async("text") ?? Promise.resolve(""),
    zip.file("docProps/app.xml")?.async("text") ?? Promise.resolve(""),
    mammoth.extractRawText({ buffer })
  ]);

  const text = normaliseText(mammothResult.value);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    fileName: file.name,
    text,
    paragraphs,
    documentXml,
    coreXml,
    appXml,
    metadata: parseMetadata(coreXml, appXml)
  };
}

function normaliseText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function parseMetadata(coreXml: string, appXml: string): DocumentMetadata {
  return {
    ...emptyMetadata,
    creator: readXmlTag(coreXml, "creator"),
    lastModifiedBy: readXmlTag(coreXml, "lastModifiedBy"),
    created: readXmlTag(coreXml, "created"),
    modified: readXmlTag(coreXml, "modified"),
    revision: readXmlTag(coreXml, "revision"),
    totalTimeMinutes: readXmlTag(appXml, "TotalTime"),
    wordCount: readXmlTag(appXml, "Words"),
    pages: readXmlTag(appXml, "Pages"),
    application: readXmlTag(appXml, "Application")
  };
}

function readXmlTag(xml: string, localName: string) {
  if (!xml) {
    return "N/A";
  }

  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<[^>]*:?${escaped}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${escaped}>`, "i"));
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() || "N/A";
}
