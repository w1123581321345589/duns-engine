import { pgTable, serial, text, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotaUsageTable = pgTable(
  "quota_usage",
  {
    id: serial("id").primaryKey(),
    country_code: text("country_code").notNull(),
    research_type: text("research_type").notNull().default("Mini"),
    date: date("date").notNull(),
    used: integer("used").notNull().default(0),
    limit: integer("limit").notNull().default(25),
  },
  (table) => [unique().on(table.country_code, table.date, table.research_type)]
);

export const insertQuotaSchema = createInsertSchema(quotaUsageTable).omit({ id: true });
export type InsertQuota = z.infer<typeof insertQuotaSchema>;
export type QuotaUsage = typeof quotaUsageTable.$inferSelect;
