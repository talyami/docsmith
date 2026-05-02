# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: Universal DOCX Converter (DocStudio)

### Purpose
A web app that converts any document format into a clean, professionally formatted `.docx` Word file.

### Supported Input Formats
- `.docx` — Preserve + Clean
- `.doc` — Convert + Clean
- `.pdf` — Extract + Rebuild
- `.md` — Parse + Rebuild
- `.html` — Parse DOM + Rebuild
- `.rtf` — Read + Normalize
- `.txt` — Infer + Rebuild
- `.csv` — Interpret as Table
- `.json` — Interpret as Data
- `.xml` — Parse + Remap
- `.yaml` — Interpret Config
- `.tex` — Parse + Rebuild
- `.rst` — Parse + Rebuild

### Frontend: `artifacts/docx-converter`
- React + Vite, Tailwind CSS, shadcn/ui, Wouter for routing
- Pages: `/` (converter), `/history`, `/stats`
- File upload with drag-and-drop, progress polling, download link

### Backend: `artifacts/api-server`
- Express 5 API server on `/api`
- File upload at `POST /api/convert` (multipart/form-data)
- Conversion logic in `artifacts/api-server/src/lib/converter.ts`
- Uses: `mammoth`, `pdf-parse`, `jsdom`, `papaparse`, `js-yaml`, `docx`, `multer`

### Database Schema: `lib/db/src/schema/conversions.ts`
- `conversions` table: tracks all conversion jobs with status, file info, download path

### Conversion Pipeline (per format)
- Markdown → parse headings/lists/tables → build docx
- HTML → parse DOM → extract semantic structure → build docx
- CSV → parse rows → render as Word tables
- JSON/YAML → interpret key-value hierarchy → render as sections/tables
- PDF → extract text → rebuild as docx
- DOCX/DOC → extract text with mammoth → rebuild clean
- TXT/RTF/TEX/RST → infer structure → rebuild
