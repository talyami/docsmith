import { logger } from "./logger";

export interface AiContentBlock {
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
  rows?: string[][];
  level?: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b:free";
const MAX_INPUT_CHARS = 30_000;
const MAX_OUTPUT_TOKENS = 16_000;
const REQUEST_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = `You are DocSmith — an expert document-structuring AI.
Given the raw text extracted from a document, analyse its logical structure and return a clean, well-formatted JSON representation that another program will turn into a Microsoft Word file.

Return ONLY a JSON object of the form:
{ "blocks": [ ...content blocks... ] }

Each content block is one of these shapes:
- { "type": "heading1", "text": "..." }      // top-level title
- { "type": "heading2", "text": "..." }      // section
- { "type": "heading3", "text": "..." }      // subsection
- { "type": "paragraph", "text": "..." }     // body paragraph
- { "type": "bullet", "text": "...", "level": 0 }   // bullet list item, level 0-8
- { "type": "numbered", "text": "...", "level": 0 } // ordered list item, level 0-8
- { "type": "table", "rows": [["h1","h2"], ["a","b"], ...] }  // first row is header
- { "type": "code", "text": "..." }          // monospace code block
- { "type": "hr" }                           // horizontal divider

Rules:
1. Detect the document title and emit it as heading1 first if it exists.
2. Use heading2 / heading3 for sections and subsections — never invent extra headings.
3. Combine consecutive lines into proper paragraphs unless the source clearly intends line breaks.
4. Detect lists, tables, and code blocks even from messy plain text.
5. Strip page numbers, repeated headers/footers, and OCR noise.
6. Preserve information faithfully; do NOT summarise or paraphrase the content.
7. Output valid JSON only — no markdown fences, no comments, no extra prose.`;

/**
 * Extract a JSON object from a model response that may contain code fences,
 * reasoning text, or stray characters around the JSON payload.
 */
function extractJson(raw: string): { blocks?: AiContentBlock[] } | AiContentBlock[] | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  // Find the outermost JSON object/array using brace matching
  const candidates: string[] = [];
  for (const open of ["{", "["]) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          candidates.push(cleaned.slice(start, i + 1));
          break;
        }
      }
    }
  }

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try next
    }
  }

  return null;
}

export async function parseWithAi(
  rawText: string,
  filename: string,
): Promise<AiContentBlock[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const trimmed =
    rawText.length > MAX_INPUT_CHARS
      ? rawText.slice(0, MAX_INPUT_CHARS) + "\n\n[... truncated ...]"
      : rawText;

  const userPrompt = `File: ${filename}\n\n--- RAW TEXT ---\n${trimmed}\n--- END ---\n\nRespond with ONLY a JSON object of the form {"blocks":[...]}. Start your response with the character { and end with the character }. No prose, no markdown fences, no explanation.`;

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { exclude: true },
  };

  logger.info({ filename, chars: trimmed.length, model: MODEL }, "Calling OpenRouter AI parser");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://docsmith.replit.app",
        "X-Title": "DocSmith",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logger.error({ status: res.status, errText }, "OpenRouter request failed");
    throw new Error(`OpenRouter API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message ?? "unknown"}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned empty response");
  }

  const parsed = extractJson(content);
  if (!parsed) {
    logger.error({ content: content.slice(0, 800) }, "Failed to parse AI JSON");
    throw new Error("AI returned invalid JSON");
  }

  const blocks = Array.isArray(parsed) ? parsed : parsed.blocks ?? [];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error("AI returned no content blocks");
  }

  // Sanitise blocks — discard unknown types, clamp level
  const validTypes = new Set([
    "heading1", "heading2", "heading3", "paragraph",
    "bullet", "numbered", "table", "code", "hr",
  ]);
  const sanitised: AiContentBlock[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object" || !validTypes.has(b.type)) continue;
    const block: AiContentBlock = { type: b.type };
    if (typeof b.text === "string") block.text = b.text;
    if (Array.isArray(b.rows)) {
      block.rows = b.rows
        .filter((r) => Array.isArray(r))
        .map((r) => r.map((cell) => String(cell ?? "")));
    }
    if (typeof b.level === "number" && b.level >= 0) {
      block.level = Math.min(Math.floor(b.level), 8);
    }
    sanitised.push(block);
  }

  if (sanitised.length === 0) {
    throw new Error("AI returned no valid content blocks");
  }

  logger.info({ filename, blockCount: sanitised.length }, "AI parsing complete");
  return sanitised;
}
