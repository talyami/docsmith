import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { db, conversionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  GetConversionParams,
  DeleteConversionParams,
  ListConversionsResponse,
  GetConversionResponse,
  GetConversionStatsResponse,
} from "@workspace/api-zod";
import { convertFile } from "../lib/converter";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const OUTPUTS_DIR = path.resolve(process.cwd(), "outputs");

async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
}

ensureDirs().catch((err) => logger.error({ err }, "Failed to create upload dirs"));

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureDirs();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [
      ".md", ".txt", ".html", ".htm", ".rtf", ".csv", ".json",
      ".xml", ".yaml", ".yml", ".tex", ".rst", ".pdf", ".doc", ".docx",
    ];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

router.post("/convert", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const originalExt = path.extname(file.originalname).toLowerCase();
  const originalFilename = file.originalname;
  const fileSize = file.size;
  const useAi = req.body?.useAi === "true" || req.body?.useAi === true;

  const [record] = await db
    .insert(conversionsTable)
    .values({
      originalFilename,
      originalExtension: originalExt,
      fileSize,
      status: "processing",
      useAi,
    })
    .returning();

  res.status(202).json(GetConversionResponse.parse(record));

  setImmediate(async () => {
    try {
      const result = await convertFile(file.path, originalFilename, originalExt, useAi);
      const outputFilename = `${record.id}-${path.basename(originalFilename, originalExt)}.docx`;
      const outputPath = path.join(OUTPUTS_DIR, outputFilename);
      await fs.writeFile(outputPath, result.docxBuffer);

      await db
        .update(conversionsTable)
        .set({
          status: "done",
          downloadPath: `/api/conversions/${record.id}/download`,
          processingMode: result.mode,
          updatedAt: new Date(),
        })
        .where(eq(conversionsTable.id, record.id));

      logger.info({ id: record.id, mode: result.mode }, "Conversion completed");
    } catch (err) {
      logger.error({ err, id: record.id }, "Conversion failed");
      await db
        .update(conversionsTable)
        .set({
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(conversionsTable.id, record.id));
    } finally {
      fs.unlink(file.path).catch(() => {});
    }
  });
});

router.get("/conversions", async (req, res): Promise<void> => {
  const conversions = await db
    .select()
    .from(conversionsTable)
    .orderBy(desc(conversionsTable.createdAt))
    .limit(100);

  res.json(ListConversionsResponse.parse(conversions));
});

router.get("/conversions/stats", async (req, res): Promise<void> => {
  const conversions = await db.select().from(conversionsTable);

  const total = conversions.length;
  const done = conversions.filter((c) => c.status === "done").length;
  const error = conversions.filter((c) => c.status === "error").length;
  const pending = conversions.filter((c) => c.status === "pending" || c.status === "processing").length;

  const extCounts: Record<string, number> = {};
  for (const c of conversions) {
    extCounts[c.originalExtension] = (extCounts[c.originalExtension] ?? 0) + 1;
  }

  const byExtension = Object.entries(extCounts).map(([extension, count]) => ({
    extension,
    count,
  }));

  res.json(
    GetConversionStatsResponse.parse({ total, done, error, pending, byExtension })
  );
});

router.get("/conversions/:id", async (req, res): Promise<void> => {
  const params = GetConversionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversion] = await db
    .select()
    .from(conversionsTable)
    .where(eq(conversionsTable.id, params.data.id));

  if (!conversion) {
    res.status(404).json({ error: "Conversion not found" });
    return;
  }

  res.json(GetConversionResponse.parse(conversion));
});

router.get("/conversions/:id/download", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [conversion] = await db
    .select()
    .from(conversionsTable)
    .where(eq(conversionsTable.id, id));

  if (!conversion || conversion.status !== "done") {
    res.status(404).json({ error: "File not found or not ready" });
    return;
  }

  const outputFilename = `${conversion.id}-${path.basename(conversion.originalFilename, conversion.originalExtension)}.docx`;
  const outputPath = path.join(OUTPUTS_DIR, outputFilename);

  try {
    await fs.access(outputPath);
    const downloadName = `${path.basename(conversion.originalFilename, conversion.originalExtension)}.docx`;
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.sendFile(outputPath);
  } catch {
    res.status(404).json({ error: "Output file not found" });
  }
});

router.delete("/conversions/:id", async (req, res): Promise<void> => {
  const params = DeleteConversionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(conversionsTable)
    .where(eq(conversionsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Conversion not found" });
    return;
  }

  const outputFilename = `${deleted.id}-${path.basename(deleted.originalFilename, deleted.originalExtension)}.docx`;
  const outputPath = path.join(OUTPUTS_DIR, outputFilename);
  fs.unlink(outputPath).catch(() => {});

  res.sendStatus(204);
});

export default router;
