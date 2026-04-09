import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversionStatusEnum = pgEnum("conversion_status", ["pending", "processing", "done", "error"]);

export const conversionsTable = pgTable("conversions", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  originalExtension: text("original_extension").notNull(),
  fileSize: integer("file_size").notNull(),
  status: conversionStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  downloadPath: text("download_path"),
  processingMode: text("processing_mode"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversionSchema = createInsertSchema(conversionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversion = z.infer<typeof insertConversionSchema>;
export type Conversion = typeof conversionsTable.$inferSelect;
