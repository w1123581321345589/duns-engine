import { pgTable, serial, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const caseStatusEnum = pgEnum("case_status", [
  "pending_match",
  "match_found",
  "queued",
  "submitted",
  "received",
  "in_progress",
  "closed_created",
  "closed_exists",
  "closed_failed",
  "challenged",
  "error",
]);

export const casesTable = pgTable(
  "cases",
  {
    id: serial("id").primaryKey(),
    case_id: text("case_id").notNull().unique(),
    status: caseStatusEnum("status").notNull().default("pending_match"),
    duns_number: text("duns_number"),
    // Demo affordance: when a requester supplies a DUNS up front, the simulated
    // D&B resolution returns this exact number instead of a random one, so a
    // live walkthrough deterministically delivers the number you typed in.
    requested_duns: text("requested_duns"),
    business_name: text("business_name").notNull(),
    street_address: text("street_address").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    postal_code: text("postal_code"),
    country_code: text("country_code").notNull().default("US"),
    phone: text("phone"),
    requestor_email: text("requestor_email"),
    match_confidence: integer("match_confidence"),
    resolution_code: text("resolution_code"),
    db_case_id: text("db_case_id"),
    // Source attribution + idempotency
    source: text("source"),
    source_event_id: text("source_event_id"),
    idempotency_key: text("idempotency_key").unique(),
    // Durable worker bookkeeping
    next_action_at: timestamp("next_action_at"),
    locked_at: timestamp("locked_at"),
    attempts: integer("attempts").notNull().default(0),
    max_attempts: integer("max_attempts").notNull().default(5),
    last_error: text("last_error"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    closed_at: timestamp("closed_at"),
  },
  (table) => [
    index("cases_worker_idx").on(table.status, table.next_action_at),
  ],
);

export const insertCaseSchema = createInsertSchema(casesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
  closed_at: true,
  status: true,
  duns_number: true,
  requested_duns: true,
  match_confidence: true,
  resolution_code: true,
  db_case_id: true,
  case_id: true,
  source: true,
  source_event_id: true,
  idempotency_key: true,
  next_action_at: true,
  locked_at: true,
  attempts: true,
  max_attempts: true,
  last_error: true,
});

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof casesTable.$inferSelect;
