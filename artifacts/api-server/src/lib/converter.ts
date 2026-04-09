import path from "path";
import fs from "fs/promises";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
  SectionType,
  convertMillimetersToTwip,
} from "docx";

export type ProcessingMode =
  | "preserve-and-clean"
  | "convert-then-clean"
  | "extract-and-rebuild"
  | "parse-and-rebuild"
  | "infer-and-rebuild"
  | "interpret-as-data";

export interface ConversionResult {
  mode: ProcessingMode;
  docxBuffer: Buffer;
}

interface ContentBlock {
  type:
    | "title"
    | "heading1"
    | "heading2"
    | "heading3"
    | "paragraph"
    | "bullet"
    | "numbered"
    | "table"
    | "code"
    | "hr";
  text?: string;
  rows?: string[][];
  ordered?: boolean;
}

function getProcessingMode(ext: string): ProcessingMode {
  switch (ext) {
    case ".docx":
      return "preserve-and-clean";
    case ".doc":
      return "convert-then-clean";
    case ".pdf":
      return "extract-and-rebuild";
    case ".md":
    case ".html":
    case ".rtf":
    case ".rst":
    case ".tex":
      return "parse-and-rebuild";
    case ".txt":
      return "infer-and-rebuild";
    case ".csv":
    case ".json":
    case ".xml":
    case ".yaml":
      return "interpret-as-data";
    default:
      return "parse-and-rebuild";
  }
}

function makeTitle(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.TITLE,
    spacing: { after: 300 },
    alignment: AlignmentType.LEFT,
  });
}

function makeHeading(text: string, level: 1 | 2 | 3): Paragraph {
  const map = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;
  return new Paragraph({
    text,
    heading: map[level],
    spacing: { before: 240, after: 120 },
  });
}

function makeParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function makeBullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function makeNumbered(text: string, num: number): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${num}. ${text}`, size: 22 })],
    spacing: { after: 80 },
  });
}

function makeHr(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "─".repeat(60), size: 18, color: "AAAAAA" })],
    spacing: { before: 120, after: 120 },
  });
}

function makeTable(rows: string[][]): Table {
  if (rows.length === 0) return new Table({ rows: [] });

  const docRows = rows.map((row, rowIndex) => {
    return new TableRow({
      children: row.map((cell) => {
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell,
                  size: 20,
                  bold: rowIndex === 0,
                }),
              ],
              spacing: { after: 60, before: 60 },
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          shading: rowIndex === 0 ? { fill: "F2F2F2" } : undefined,
          width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
        });
      }),
    });
  });

  return new Table({
    rows: docRows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

function blocksToDocxChildren(blocks: ContentBlock[]): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  let numberedCount = 0;

  for (const block of blocks) {
    if (block.type === "numbered") {
      numberedCount++;
    } else {
      numberedCount = 0;
    }

    switch (block.type) {
      case "title":
        children.push(makeTitle(block.text ?? ""));
        break;
      case "heading1":
        children.push(makeHeading(block.text ?? "", 1));
        break;
      case "heading2":
        children.push(makeHeading(block.text ?? "", 2));
        break;
      case "heading3":
        children.push(makeHeading(block.text ?? "", 3));
        break;
      case "paragraph":
      case "code":
        children.push(makeParagraph(block.text ?? ""));
        break;
      case "bullet":
        children.push(makeBullet(block.text ?? ""));
        break;
      case "numbered":
        children.push(makeNumbered(block.text ?? "", numberedCount));
        break;
      case "table":
        if (block.rows && block.rows.length > 0) {
          children.push(makeTable(block.rows));
          children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        }
        break;
      case "hr":
        children.push(makeHr());
        break;
    }
  }

  return children;
}

function buildDocx(
  title: string,
  blocks: ContentBlock[],
  subtitle?: string
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(makeTitle(title));
  if (subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: subtitle, size: 20, color: "888888" })],
        spacing: { after: 400 },
      })
    );
  }
  children.push(makeHr());
  children.push(...blocksToDocxChildren(blocks));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
            },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
          },
        },
        heading1: {
          run: {
            font: "Calibri",
            size: 32,
            bold: true,
            color: "1a1a2e",
          },
        },
        heading2: {
          run: {
            font: "Calibri",
            size: 26,
            bold: true,
            color: "16213e",
          },
        },
        heading3: {
          run: {
            font: "Calibri",
            size: 22,
            bold: true,
            color: "0f3460",
          },
        },
        title: {
          run: {
            font: "Calibri",
            size: 48,
            bold: true,
            color: "1a1a2e",
          },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

async function parseMarkdown(content: string): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");
  let inTable = false;
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        if (codeLines.length > 0) {
          blocks.push({ type: "code", text: codeLines.join("\n") });
          codeLines = [];
        }
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const parts = line
        .trim()
        .split("|")
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)
        .map((p) => p.trim());

      if (parts.every((p) => p.match(/^[-:]+$/))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(parts);
      continue;
    } else if (inTable) {
      if (tableRows.length > 0) {
        blocks.push({ type: "table", rows: tableRows });
      }
      inTable = false;
      tableRows = [];
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "heading1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "heading2", text: line.slice(3).trim() });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "heading3", text: line.slice(4).trim() });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ type: "bullet", text: line.slice(2).trim() });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ type: "numbered", text: line.replace(/^\d+\.\s/, "").trim() });
    } else if (line.trim() === "---" || line.trim() === "***") {
      blocks.push({ type: "hr" });
    } else if (line.trim() !== "") {
      blocks.push({ type: "paragraph", text: line.trim() });
    }
  }

  if (inTable && tableRows.length > 0) {
    blocks.push({ type: "table", rows: tableRows });
  }

  return blocks;
}

function parsePlainText(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");
  let titleFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!titleFound && /^[A-Z][A-Z\s]+$/.test(trimmed) && trimmed.length < 80) {
      blocks.push({ type: "heading1", text: trimmed });
      titleFound = true;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ type: "numbered", text: trimmed.replace(/^\d+\.\s/, "").trim() });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      blocks.push({ type: "bullet", text: trimmed.slice(2).trim() });
    } else if (/^[A-Z][^a-z]*:?$/.test(trimmed) && trimmed.length < 60) {
      blocks.push({ type: "heading2", text: trimmed });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }

  return blocks;
}

async function parseHtml(content: string): Promise<ContentBlock[]> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(content);
  const doc = dom.window.document;
  const blocks: ContentBlock[] = [];

  function processNode(node: Element): void {
    const tag = node.tagName?.toLowerCase();

    if (tag === "h1")
      blocks.push({ type: "heading1", text: node.textContent?.trim() ?? "" });
    else if (tag === "h2")
      blocks.push({ type: "heading2", text: node.textContent?.trim() ?? "" });
    else if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6")
      blocks.push({ type: "heading3", text: node.textContent?.trim() ?? "" });
    else if (tag === "p") {
      const text = node.textContent?.trim() ?? "";
      if (text) blocks.push({ type: "paragraph", text });
    } else if (tag === "ul" || tag === "ol") {
      const ordered = tag === "ol";
      node.querySelectorAll("li").forEach((li) => {
        const text = li.textContent?.trim() ?? "";
        if (text)
          blocks.push({ type: ordered ? "numbered" : "bullet", text });
      });
    } else if (tag === "table") {
      const rows: string[][] = [];
      node.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll("th, td")).map(
          (cell) => cell.textContent?.trim() ?? ""
        );
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0) blocks.push({ type: "table", rows });
    } else if (tag === "hr") {
      blocks.push({ type: "hr" });
    } else {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 1) processNode(child as Element);
      });
    }
  }

  const body = doc.body;
  if (body) {
    body.childNodes.forEach((child) => {
      if (child.nodeType === 1) processNode(child as Element);
    });
  }

  return blocks;
}

async function parseCsv(content: string): Promise<ContentBlock[]> {
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const rows = result.data as string[][];

  if (rows.length === 0) return [];

  return [{ type: "table", rows }];
}

async function parseJson(content: string): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [{ type: "paragraph", text: "Invalid JSON content" }];
  }

  function processValue(key: string, value: unknown, depth = 0): void {
    if (value === null || value === undefined) {
      blocks.push({ type: "bullet", text: `${key}: (empty)` });
    } else if (Array.isArray(value)) {
      if (depth === 0) blocks.push({ type: "heading2", text: key });
      else blocks.push({ type: "heading3", text: key });

      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        const keys = Object.keys(value[0] as object);
        const rows: string[][] = [keys];
        for (const item of value.slice(0, 50)) {
          if (typeof item === "object" && item !== null) {
            rows.push(keys.map((k) => String((item as Record<string, unknown>)[k] ?? "")));
          }
        }
        blocks.push({ type: "table", rows });
      } else {
        for (const item of value) {
          blocks.push({ type: "bullet", text: String(item) });
        }
      }
    } else if (typeof value === "object") {
      if (depth === 0) blocks.push({ type: "heading2", text: key });
      else blocks.push({ type: "heading3", text: key });

      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        processValue(k, v, depth + 1);
      }
    } else {
      blocks.push({ type: "bullet", text: `${key}: ${String(value)}` });
    }
  }

  if (Array.isArray(parsed)) {
    processValue("Data", parsed, 0);
  } else if (typeof parsed === "object" && parsed !== null) {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      processValue(k, v, 0);
    }
  } else {
    blocks.push({ type: "paragraph", text: String(parsed) });
  }

  return blocks;
}

async function parseYaml(content: string): Promise<ContentBlock[]> {
  const yaml = (await import("js-yaml")).default;
  const blocks: ContentBlock[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch {
    return [{ type: "paragraph", text: "Invalid YAML content" }];
  }

  function processValue(key: string, value: unknown, depth = 0): void {
    if (value === null || value === undefined) {
      blocks.push({ type: "bullet", text: `${key}: (null)` });
    } else if (Array.isArray(value)) {
      if (depth === 0) blocks.push({ type: "heading2", text: key });
      else blocks.push({ type: "heading3", text: key });

      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            processValue(k, v, depth + 1);
          }
          blocks.push({ type: "hr" });
        } else {
          blocks.push({ type: "bullet", text: String(item) });
        }
      }
    } else if (typeof value === "object") {
      if (depth === 0) blocks.push({ type: "heading2", text: key });
      else blocks.push({ type: "heading3", text: key });

      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        processValue(k, v, depth + 1);
      }
    } else {
      blocks.push({ type: "bullet", text: `${key}: ${String(value)}` });
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      processValue(k, v, 0);
    }
  } else {
    blocks.push({ type: "paragraph", text: String(parsed) });
  }

  return blocks;
}

async function parseXml(content: string): Promise<ContentBlock[]> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(content, { contentType: "text/xml" });
  const doc = dom.window.document;
  const blocks: ContentBlock[] = [];

  function processNode(node: Element, depth = 0): void {
    const tag = node.tagName;
    const children = Array.from(node.children);
    const text = node.textContent?.trim() ?? "";

    if (children.length === 0) {
      if (text) blocks.push({ type: "bullet", text: `${tag}: ${text}` });
    } else {
      if (depth === 0) blocks.push({ type: "heading2", text: tag });
      else blocks.push({ type: "heading3", text: tag });

      for (const child of children) {
        processNode(child, depth + 1);
      }
    }
  }

  const root = doc.documentElement;
  if (root) {
    blocks.push({ type: "heading1", text: root.tagName });
    for (const child of Array.from(root.children)) {
      processNode(child as Element, 0);
    }
  }

  return blocks;
}

async function parseTex(content: string): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;

    const titleMatch = trimmed.match(/\\title\{(.+?)\}/);
    if (titleMatch) {
      blocks.push({ type: "heading1", text: titleMatch[1] });
      continue;
    }

    const sectionMatch = trimmed.match(/\\section\{(.+?)\}/);
    if (sectionMatch) {
      blocks.push({ type: "heading2", text: sectionMatch[1] });
      continue;
    }

    const subsectionMatch = trimmed.match(/\\subsection\{(.+?)\}/);
    if (subsectionMatch) {
      blocks.push({ type: "heading3", text: subsectionMatch[1] });
      continue;
    }

    const itemMatch = trimmed.match(/\\item\s+(.*)/);
    if (itemMatch) {
      blocks.push({ type: "bullet", text: itemMatch[1].replace(/\\[a-z]+\{([^}]*)\}/g, "$1") });
      continue;
    }

    const cleaned = trimmed
      .replace(/\\begin\{[^}]+\}/g, "")
      .replace(/\\end\{[^}]+\}/g, "")
      .replace(/\\[a-z]+\{([^}]*)\}/g, "$1")
      .replace(/\\[a-z]+/g, "")
      .trim();

    if (cleaned) blocks.push({ type: "paragraph", text: cleaned });
  }

  return blocks;
}

async function parseRst(content: string): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? "";

    if (nextLine && nextLine.match(/^[=\-~^"]+$/) && nextLine.length >= line.length - 2) {
      const marker = nextLine[0];
      if (marker === "=") blocks.push({ type: "heading1", text: line.trim() });
      else if (marker === "-") blocks.push({ type: "heading2", text: line.trim() });
      else blocks.push({ type: "heading3", text: line.trim() });
      i++;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      blocks.push({ type: "bullet", text: trimmed.slice(2) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ type: "numbered", text: trimmed.replace(/^\d+\.\s/, "") });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }

  return blocks;
}

async function parsePdf(filePath: string): Promise<ContentBlock[]> {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return parsePlainText(data.text);
}

async function parseDocx(filePath: string): Promise<ContentBlock[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return parsePlainText(result.value);
}

export async function convertFile(
  filePath: string,
  originalFilename: string,
  ext: string
): Promise<ConversionResult> {
  const mode = getProcessingMode(ext);
  const baseName = path.basename(originalFilename, ext);
  let blocks: ContentBlock[] = [];
  let subtitle: string | undefined;

  switch (ext) {
    case ".md": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseMarkdown(content);
      subtitle = "Converted from Markdown";
      break;
    }
    case ".txt": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = parsePlainText(content);
      subtitle = "Converted from Plain Text";
      break;
    }
    case ".html": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseHtml(content);
      subtitle = "Converted from HTML";
      break;
    }
    case ".csv": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseCsv(content);
      subtitle = "Converted from CSV";
      break;
    }
    case ".json": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseJson(content);
      subtitle = "Converted from JSON";
      break;
    }
    case ".yaml":
    case ".yml": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseYaml(content);
      subtitle = "Converted from YAML";
      break;
    }
    case ".xml": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseXml(content);
      subtitle = "Converted from XML";
      break;
    }
    case ".tex": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseTex(content);
      subtitle = "Converted from LaTeX";
      break;
    }
    case ".rst": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseRst(content);
      subtitle = "Converted from reStructuredText";
      break;
    }
    case ".pdf": {
      blocks = await parsePdf(filePath);
      subtitle = "Converted from PDF";
      break;
    }
    case ".docx":
    case ".doc": {
      blocks = await parseDocx(filePath);
      subtitle = `Converted from ${ext.toUpperCase()}`;
      break;
    }
    case ".rtf": {
      const content = await fs.readFile(filePath, "utf-8");
      const plainText = content
        .replace(/\{\\[^}]+\}/g, "")
        .replace(/\\[a-z]+\d*\s?/g, " ")
        .replace(/[{}]/g, "")
        .trim();
      blocks = parsePlainText(plainText);
      subtitle = "Converted from RTF";
      break;
    }
    default: {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = parsePlainText(content);
      subtitle = "Converted from text file";
    }
  }

  const docxBuffer = await buildDocx(baseName, blocks, subtitle);

  return { mode, docxBuffer };
}
