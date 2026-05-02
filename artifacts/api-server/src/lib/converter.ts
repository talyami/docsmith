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
  LevelFormat,
  convertMillimetersToTwip,
  TableOfContents,
  ShadingType,
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

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

interface ContentBlock {
  type:
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
  segments?: TextSegment[];
  rows?: string[][];
  level?: number; // 0-based nesting depth for bullet/numbered lists
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

// Parse inline markdown: **bold**, *italic*, `code`, combinations
function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Combined regex for **bold**, *italic*, `code`
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // ***bold+italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], italic: true });
    } else if (match[5]) {
      // `code`
      segments.push({ text: match[5], code: true });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

function segmentsToRuns(segments: TextSegment[]): TextRun[] {
  return segments.map(
    (seg) =>
      new TextRun({
        text: seg.text,
        bold: seg.bold,
        italics: seg.italic,
        font: seg.code ? "Courier New" : "Calibri",
        size: seg.code ? 20 : 22,
        color: seg.code ? "555555" : undefined,
      })
  );
}

function makeHeading(text: string, level: 1 | 2 | 3): Paragraph {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    heading: headingMap[level],
  });
}

function makeParagraph(text: string, segments?: TextSegment[]): Paragraph {
  const runs = segments ? segmentsToRuns(segments) : [new TextRun({ text: text ?? "", size: 22 })];
  return new Paragraph({
    children: runs,
    spacing: { after: 160, line: 276, lineRule: "auto" },
  });
}

function makeBullet(text: string, level = 0, segments?: TextSegment[]): Paragraph {
  const runs = segments ? segmentsToRuns(segments) : [new TextRun({ text: text ?? "", size: 22 })];
  return new Paragraph({
    children: runs,
    bullet: { level: Math.min(level, 8) },
    spacing: { after: 80, line: 276, lineRule: "auto" },
  });
}

function makeNumbered(text: string, level = 0, segments?: TextSegment[]): Paragraph {
  const contentRuns = segments ? segmentsToRuns(segments) : [new TextRun({ text: text ?? "", size: 22 })];
  return new Paragraph({
    children: contentRuns,
    numbering: { reference: "numbered-list", level: Math.min(level, 8) },
    spacing: { after: 80, line: 276, lineRule: "auto" },
  });
}

function makeHr(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", size: 4 })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD" },
    },
    spacing: { before: 160, after: 160 },
  });
}

function makeTable(rows: string[][]): Table {
  if (rows.length === 0) return new Table({ rows: [] });

  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(9000 / colCount);

  const docRows = rows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const isEven = rowIndex % 2 === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: row.map((cell) => {
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.trim(),
                  size: 20,
                  bold: isHeader,
                  color: isHeader ? "FFFFFF" : "000000",
                  font: "Calibri",
                }),
              ],
              spacing: { after: 80, before: 80, line: 276, lineRule: "auto" },
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: isHeader ? 4 : 2, color: isHeader ? "2E5FA3" : "C8D8EE" },
            bottom: { style: BorderStyle.SINGLE, size: isHeader ? 4 : 2, color: isHeader ? "2E5FA3" : "C8D8EE" },
            left: { style: BorderStyle.SINGLE, size: 2, color: isHeader ? "2E5FA3" : "C8D8EE" },
            right: { style: BorderStyle.SINGLE, size: 2, color: isHeader ? "2E5FA3" : "C8D8EE" },
          },
          shading: isHeader
            ? { fill: "2E5FA3", type: ShadingType.SOLID, color: "2E5FA3" }
            : isEven
              ? { fill: "F2F6FC", type: ShadingType.SOLID, color: "F2F6FC" }
              : { fill: "FFFFFF", type: ShadingType.SOLID, color: "FFFFFF" },
          margins: {
            top: 80,
            bottom: 80,
            left: 120,
            right: 120,
          },
          width: { size: colWidth, type: WidthType.DXA },
        });
      }),
    });
  });

  return new Table({
    rows: docRows,
    width: { size: 9000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "2E5FA3" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E5FA3" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "2E5FA3" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "2E5FA3" },
    },
  });
}

function blocksToDocxChildren(blocks: ContentBlock[]): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    const level = block.level ?? 0;

    switch (block.type) {
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
        children.push(makeParagraph(block.text ?? "", block.segments));
        break;
      case "code": {
        const codeLines = (block.text ?? "").split("\n");
        for (const codeLine of codeLines) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: codeLine, font: "Courier New", size: 20, color: "333333" }),
              ],
              spacing: { after: 0, before: 0, line: 240, lineRule: "auto" },
              indent: { left: 360, right: 360 },
              shading: { type: ShadingType.SOLID, fill: "F4F4F4", color: "F4F4F4" },
            })
          );
        }
        children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        break;
      }
      case "bullet":
        children.push(makeBullet(block.text ?? "", level, block.segments));
        break;
      case "numbered":
        children.push(makeNumbered(block.text ?? "", level, block.segments));
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

function buildDocx(blocks: ContentBlock[]): Promise<Buffer> {
  const toc = new TableOfContents("Table of Contents", {
    headingStyleRange: "1-3",
  });

  const bodyChildren = blocksToDocxChildren(blocks);

  // Build multilevel numbering (9 levels of decimal numbering)
  const numberedLevels = Array.from({ length: 9 }, (_, i) => ({
    level: i,
    format: LevelFormat.DECIMAL,
    text: `%${i + 1}.`,
    alignment: AlignmentType.START,
    style: {
      paragraph: {
        indent: { left: 360 + i * 360, hanging: 260 },
      },
      run: { font: "Calibri", size: 22 },
    },
  }));

  const doc = new Document({
    numbering: {
      config: [{ reference: "numbered-list", levels: numberedLevels }],
    },
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
        children: [toc, makeHr(), ...bodyChildren],
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
          },
          paragraph: {
            spacing: { line: 276, lineRule: "auto" },
          },
        },
        heading1: {
          run: {
            font: "Calibri",
            size: 72,
            bold: true,
            color: "1F3864",
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: {
            font: "Calibri",
            size: 56,
            bold: true,
            color: "2E5FA3",
          },
          paragraph: {
            spacing: { before: 320, after: 160 },
          },
        },
        heading3: {
          run: {
            font: "Calibri",
            size: 44,
            bold: true,
            color: "4472C4",
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
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

    if (line.trim().startsWith("```")) {
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

    // Markdown tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const parts = line
        .trim()
        .split("|")
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)
        .map((p) => p.trim());

      // Separator row like |---|---|
      if (parts.every((p) => /^[-:\s]+$/.test(p))) {
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
    } else if (line.startsWith("#### ") || line.startsWith("##### ")) {
      blocks.push({ type: "heading3", text: line.replace(/^#+\s/, "").trim() });
    } else if (/^(\s+)?[-*+]\s/.test(line)) {
      const lvl = indentLevel(line);
      const text = line.trim().replace(/^[-*+]\s+/, "");
      blocks.push({ type: "bullet", text, level: lvl, segments: parseInlineMarkdown(text) });
    } else if (/^(\s+)?\d+\.\s/.test(line)) {
      const lvl = indentLevel(line);
      const text = line.trim().replace(/^\d+\.\s+/, "");
      blocks.push({ type: "numbered", text, level: lvl, segments: parseInlineMarkdown(text) });
    } else if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
      blocks.push({ type: "hr" });
    } else if (line.trim() !== "") {
      const text = line.trim();
      blocks.push({ type: "paragraph", text, segments: parseInlineMarkdown(text) });
    }
  }

  if (inTable && tableRows.length > 0) {
    blocks.push({ type: "table", rows: tableRows });
  }
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }

  return blocks;
}

function isTableRow(line: string): boolean {
  return line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|");
}

/** Count leading spaces / tabs (tabs = 4 spaces) to determine nesting level */
function indentLevel(line: string): number {
  let spaces = 0;
  for (const ch of line) {
    if (ch === "\t") spaces += 4;
    else if (ch === " ") spaces += 1;
    else break;
  }
  return Math.floor(spaces / 4);
}

function parsePlainText(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const level = indentLevel(rawLine);

    // Skip completely blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // ── Markdown-style headings (common in .txt files) ──────────────────────
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "heading3", text: trimmed.slice(4).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading2", text: trimmed.slice(3).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading1", text: trimmed.slice(2).trim() });
      i++;
      continue;
    }

    // ── Underline-style headings (=== or ---) ────────────────────────────────
    const nextRaw = lines[i + 1] ?? "";
    const nextTrimmed = nextRaw.trim();
    if (nextTrimmed && /^[=\-]+$/.test(nextTrimmed) && nextTrimmed.length >= trimmed.length - 2) {
      const headType = nextTrimmed[0] === "=" ? "heading1" : "heading2";
      blocks.push({ type: headType, text: trimmed });
      i += 2;
      continue;
    }

    // ── ASCII box table (+---+---+) ───────────────────────────────────────────
    if (/^\+[-=+]+\+/.test(trimmed)) {
      const tableRows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (/^\+[-=+]+\+/.test(rowLine)) {
          // separator row, skip it
          i++;
          continue;
        }
        if (rowLine.startsWith("|") && rowLine.endsWith("|")) {
          const cells = rowLine
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          tableRows.push(cells);
          i++;
          continue;
        }
        break;
      }
      if (tableRows.length > 0) blocks.push({ type: "table", rows: tableRows });
      continue;
    }

    // ── Space-aligned column table (dashed separator row) ────────────────────
    {
      const nextRaw2 = lines[i + 1] ?? "";
      const nextTrimmed2 = nextRaw2.trim();
      // A separator row has 2+ groups of dashes separated by whitespace, nothing else
      const dashGroups = nextTrimmed2.split(/\s+/).filter((g) => /^-+$/.test(g));
      const isDashSeparator = /^[-\s]+$/.test(nextTrimmed2) && dashGroups.length >= 2;
      if (isDashSeparator && nextTrimmed2.length > 0) {
        // Find column boundaries from separator
        const colBounds: Array<[number, number]> = [];
        const sepLine = nextRaw2.replace(/\t/g, "    ");
        let inDash = false;
        let colStart = 0;
        for (let ci = 0; ci <= sepLine.length; ci++) {
          const ch = ci < sepLine.length ? sepLine[ci] : " ";
          if (!inDash && ch === "-") { inDash = true; colStart = ci; }
          else if (inDash && ch !== "-") { colBounds.push([colStart, ci]); inDash = false; }
        }
        if (colBounds.length >= 2) {
          const extractRow = (line: string): string[] => {
            const padded = line.replace(/\t/g, "    ").padEnd(colBounds[colBounds.length - 1][1] + 10);
            return colBounds.map(([s, e]) => padded.slice(s, e).trim());
          };
          const tableRows: string[][] = [];
          tableRows.push(extractRow(rawLine));   // header
          i += 2;                                 // skip header + separator
          while (i < lines.length && lines[i].trim() !== "") {
            tableRows.push(extractRow(lines[i]));
            i++;
          }
          if (tableRows.length > 0) blocks.push({ type: "table", rows: tableRows });
          continue;
        }
      }
    }

    // ── Pipe-delimited table ──────────────────────────────────────────────────
    if (isTableRow(trimmed)) {
      const tableRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const row = lines[i]
          .trim()
          .split("|")
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map((p) => p.trim());
        if (!row.every((p) => /^[-:\s]+$/.test(p))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) blocks.push({ type: "table", rows: tableRows });
      continue;
    }

    // ── Numbered list: "1." / "1)" / "(1)" ───────────────────────────────────
    const numberedMatch = trimmed.match(/^(?:\(?\d+[.)]\)?\s+)(.*)/);
    if (numberedMatch) {
      const text = numberedMatch[1].trim();
      blocks.push({ type: "numbered", text, level, segments: parseInlineMarkdown(text) });
      i++;
      continue;
    }

    // ── Bullet list: "-", "*", "•", "+", "–", "▪", "○" ─────────────────────
    const bulletMatch = trimmed.match(/^(?:[-*•+–▪○]\s+)(.*)/);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      blocks.push({ type: "bullet", text, level, segments: parseInlineMarkdown(text) });
      i++;
      continue;
    }

    // ── ALL CAPS heading heuristic (short lines, all uppercase) ──────────────
    if (
      level === 0 &&
      /^[A-Z][A-Z0-9\s\-–:,./()]+$/.test(trimmed) &&
      trimmed.length >= 4 &&
      trimmed.length <= 80
    ) {
      blocks.push({ type: "heading2", text: trimmed });
      i++;
      continue;
    }

    // ── Regular paragraph ─────────────────────────────────────────────────────
    blocks.push({ type: "paragraph", text: trimmed, segments: parseInlineMarkdown(trimmed) });
    i++;
  }

  return blocks;
}

async function parseHtml(content: string): Promise<ContentBlock[]> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(content);
  const doc = dom.window.document;
  const blocks: ContentBlock[] = [];

  function processListNode(listEl: Element, ordered: boolean, depth: number): void {
    // Only direct <li> children (not nested ones)
    for (const child of Array.from(listEl.children)) {
      if (child.tagName?.toLowerCase() !== "li") continue;
      // Get text of this li, excluding nested list text
      let text = "";
      for (const node of Array.from(child.childNodes)) {
        if (node.nodeType === 3 /* TEXT_NODE */) {
          text += (node as Text).textContent ?? "";
        } else if (node.nodeType === 1) {
          const el = node as Element;
          const tag = el.tagName?.toLowerCase();
          if (tag !== "ul" && tag !== "ol") {
            text += el.textContent ?? "";
          }
        }
      }
      text = text.trim();
      if (text) {
        blocks.push({ type: ordered ? "numbered" : "bullet", text, level: depth, segments: parseInlineMarkdown(text) });
      }
      // Recurse into nested lists
      for (const nested of Array.from(child.children)) {
        const nestedTag = nested.tagName?.toLowerCase();
        if (nestedTag === "ul" || nestedTag === "ol") {
          processListNode(nested, nestedTag === "ol", depth + 1);
        }
      }
    }
  }

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
      processListNode(node, ordered, 0);
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
      if (depth === 0) blocks.push({ type: "heading1", text: key });
      else if (depth === 1) blocks.push({ type: "heading2", text: key });
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
      if (depth === 0) blocks.push({ type: "heading1", text: key });
      else if (depth === 1) blocks.push({ type: "heading2", text: key });
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
      if (depth === 0) blocks.push({ type: "heading1", text: key });
      else if (depth === 1) blocks.push({ type: "heading2", text: key });
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
      if (depth === 0) blocks.push({ type: "heading1", text: key });
      else if (depth === 1) blocks.push({ type: "heading2", text: key });
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
      if (depth === 0) blocks.push({ type: "heading1", text: tag });
      else if (depth === 1) blocks.push({ type: "heading2", text: tag });
      else blocks.push({ type: "heading3", text: tag });

      for (const child of children) {
        processNode(child, depth + 1);
      }
    }
  }

  const root = doc.documentElement;
  if (root) {
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
  const pdfParseModule = await import("pdf-parse");
  // Handle both ESM default and CJS module.exports patterns
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
    (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ??
    (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return parsePlainText(data.text);
}

async function parseDocx(filePath: string): Promise<ContentBlock[]> {
  const mammoth = await import("mammoth");
  // Use HTML conversion to preserve headings, lists, tables, bold/italic
  const result = await mammoth.convertToHtml({ path: filePath });
  return parseHtml(result.value);
}

export async function convertFile(
  filePath: string,
  originalFilename: string,
  ext: string
): Promise<ConversionResult> {
  const mode = getProcessingMode(ext);
  let blocks: ContentBlock[] = [];

  switch (ext) {
    case ".md": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseMarkdown(content);
      break;
    }
    case ".txt": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = parsePlainText(content);
      break;
    }
    case ".html": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseHtml(content);
      break;
    }
    case ".csv": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseCsv(content);
      break;
    }
    case ".json": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseJson(content);
      break;
    }
    case ".yaml":
    case ".yml": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseYaml(content);
      break;
    }
    case ".xml": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseXml(content);
      break;
    }
    case ".tex": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseTex(content);
      break;
    }
    case ".rst": {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = await parseRst(content);
      break;
    }
    case ".pdf": {
      blocks = await parsePdf(filePath);
      break;
    }
    case ".docx":
    case ".doc": {
      blocks = await parseDocx(filePath);
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
      break;
    }
    default: {
      const content = await fs.readFile(filePath, "utf-8");
      blocks = parsePlainText(content);
    }
  }

  const docxBuffer = await buildDocx(blocks);

  return { mode, docxBuffer };
}
