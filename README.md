# DocSmith

Universal file-to-DOCX converter. Drop in messy files from 13 different formats and DocSmith extracts, cleans, and rebuilds them as a polished Microsoft Word document — with optional AI-powered structure parsing.

Live preview built on Replit. This branch (`docsmith-main`) is the active fork containing the DocSmith rebrand, AI parser, and improved RTF handling.

---

## Features

- **13 input formats** — `.docx`, `.doc`, `.pdf`, `.md`, `.html`, `.rtf`, `.txt`, `.csv`, `.json`, `.xml`, `.yaml`, `.tsv`, `.log`
- **Format-aware parsers** — each type uses the right strategy: `mammoth` for DOCX, `pdf-parse` for PDF, `@iarna/rtf-to-html` + jsdom walker for RTF, dedicated parsers for structured data, and so on.
- **AI Smart Parser (optional)** — toggle on for messy or unstructured files. The server extracts raw text and sends it to OpenRouter (`openai/gpt-oss-120b:free`) which returns structured content blocks that get rebuilt as clean DOCX.
- **Live DOCX preview** — see the formatted output before downloading.
- **Conversion history & statistics** — every conversion is stored with status, mode, file size, and timestamps.
- **Mobile-responsive UI** with drag-and-drop upload.

## Tech Stack

- **Monorepo:** pnpm workspaces, TypeScript project references
- **Frontend:** React + Vite, Tailwind, shadcn/ui, TanStack Query (`artifacts/docx-converter`)
- **Backend:** Express + Pino, Zod-validated routes generated from OpenAPI (`artifacts/api-server`)
- **Database:** PostgreSQL via Drizzle ORM (`lib/db`)
- **Contracts:** OpenAPI 3 + Orval codegen for typed React Query hooks (`lib/api-spec`, `lib/api-client-react`)
- **DOCX generation:** `docx` npm package
- **AI:** OpenRouter chat-completions API

## Repo Layout

```
artifacts/
  api-server/        # Express API (file upload, conversion, AI parser)
  docx-converter/    # React UI (DocSmith)
  mockup-sandbox/    # Component preview server
lib/
  api-spec/          # openapi.yaml — single source of truth
  api-client-react/  # generated React Query hooks + Zod schemas
  db/                # Drizzle schema and migrations
scripts/             # workspace utility scripts
```

## Getting Started on Replit

1. Fork or import this repo into a Replit workspace.
2. Replit auto-installs dependencies and provisions PostgreSQL.
3. Add `OPENROUTER_API_KEY` to Secrets if you want to use the AI Smart Parser.
4. Open the preview pane — workflows are pre-configured for the API server, web UI, and mockup sandbox.

## Local Development

```bash
pnpm install
pnpm --filter @workspace/db run push           # apply schema
pnpm --filter @workspace/api-spec run codegen  # regenerate client + zod
pnpm run typecheck                             # full repo typecheck
```

Each artifact runs from its own workflow — there is intentionally no root `dev` script.

## Environment Variables

| Variable             | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection string (auto-set on Replit)      |
| `OPENROUTER_API_KEY` | Required when the AI Smart Parser toggle is enabled  |
| `SESSION_SECRET`     | Express session secret                               |
| `PORT`               | Auto-assigned per artifact by Replit                 |

## Branch Notes

- `main` — original DocStudio snapshot pushed during the initial setup.
- `docsmith-main` *(this branch)* — current state: DocSmith rebrand, AI parser via OpenRouter, hardened RTF parsing, mobile UI polish, and live DOCX preview.

## License

MIT
