import { db, casesTable, type Case } from "@workspace/db";
import { and, or, eq, lt, lte, isNull, inArray } from "drizzle-orm";
import { reserveQuota } from "./lib/quota";
import { logger } from "./lib/logger";

// Durable, restart-resumable worker that drives cases through the DUNS pipeline.
// All state lives in the `cases` table: a lease (locked_at) makes claiming
// restart-safe, next_action_at schedules the next step, and attempts/last_error
// drive exponential-backoff retries and dead-lettering. The per-step "work" here
// is a SIMULATION of Dun & Bradstreet (no real API), but the durability,
// retry, and state-machine structure is real so a live D&B client drops in later.

const TICK_MS = 1500;
const LEASE_MS = 60_000;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

// Simulated D&B latencies (kept short for the demo).
const STEP_DELAY = {
  matchToQueue: 500,
  submit: 2_000,
  receive: 2_000,
  progress: 3_000,
  resolve: 3_000,
  quotaRetry: 30_000,
} as const;

const ACTIVE_STATES: Case["status"][] = [
  "pending_match",
  "queued",
  "submitted",
  "received",
  "in_progress",
];

let timer: NodeJS.Timeout | null = null;
let isTicking = false;
let stopped = false;

function generateDuns(): string {
  return String(Math.floor(Math.random() * 900000000) + 100000000);
}

function dueIn(ms: number): Date {
  return new Date(Date.now() + ms);
}

async function claimDueCases(): Promise<Case[]> {
  const now = new Date();
  const leaseExpiry = new Date(Date.now() - LEASE_MS);
  return db
    .update(casesTable)
    .set({ locked_at: now })
    .where(
      and(
        inArray(casesTable.status, ACTIVE_STATES),
        or(isNull(casesTable.next_action_at), lte(casesTable.next_action_at, now)),
        or(isNull(casesTable.locked_at), lt(casesTable.locked_at, leaseExpiry)),
      ),
    )
    .returning();
}

async function advance(
  c: Case,
  status: Case["status"],
  delayMs: number,
  extras: Partial<typeof casesTable.$inferInsert> = {},
): Promise<void> {
  await db
    .update(casesTable)
    .set({
      status,
      next_action_at: dueIn(delayMs),
      locked_at: null,
      attempts: 0,
      last_error: null,
      updated_at: new Date(),
      ...extras,
    })
    .where(eq(casesTable.id, c.id));
}

async function terminate(
  c: Case,
  status: Case["status"],
  extras: Partial<typeof casesTable.$inferInsert> = {},
): Promise<void> {
  await db
    .update(casesTable)
    .set({
      status,
      next_action_at: null,
      locked_at: null,
      updated_at: new Date(),
      ...extras,
    })
    .where(eq(casesTable.id, c.id));
}

// pending_match: simulate D&B Identity Resolution. A strong match means the
// entity already has a DUNS, so dedupe and close without consuming quota.
async function runMatch(c: Case): Promise<void> {
  // Demo walkthrough: when a DUNS was supplied up front, drive the case through
  // every stage (no early dedupe exit) so the full pipeline is visible end to end.
  if (c.requested_duns) {
    await advance(c, "queued", STEP_DELAY.matchToQueue, { match_confidence: 4 });
    return;
  }

  const confidence = Math.floor(Math.random() * 11); // 0..10
  if (confidence >= 8) {
    await terminate(c, "closed_exists", {
      match_confidence: confidence,
      duns_number: generateDuns(),
      resolution_code: "DUPLICATE_MATCH",
      closed_at: new Date(),
      attempts: 0,
      last_error: null,
    });
    return;
  }
  await advance(c, "queued", STEP_DELAY.matchToQueue, { match_confidence: confidence });
}

// queued: reserve daily D&B quota before submitting. If the cap is reached the
// case stays queued and is retried later, so quota is never silently exceeded.
// The reservation and the status transition run in one transaction so a failed
// transition rolls back the reservation instead of leaking quota on retry.
async function runQuotaReserve(c: Case): Promise<void> {
  // Demo walkthrough: a DUNS supplied up front must always complete, so bypass
  // the daily cap and advance straight to submission instead of risking a stall
  // in "queued" once the seeded quota is exhausted.
  if (c.requested_duns) {
    await advance(c, "submitted", STEP_DELAY.submit, {
      db_case_id: `DB-${c.case_id.slice(0, 8).toUpperCase()}`,
    });
    return;
  }

  const reserved = await db.transaction(async (tx) => {
    const ok = await reserveQuota(c.country_code, tx);
    if (!ok) return false;
    await tx
      .update(casesTable)
      .set({
        status: "submitted",
        next_action_at: dueIn(STEP_DELAY.submit),
        locked_at: null,
        attempts: 0,
        last_error: null,
        updated_at: new Date(),
        db_case_id: `DB-${c.case_id.slice(0, 8).toUpperCase()}`,
      })
      .where(eq(casesTable.id, c.id));
    return true;
  });

  if (reserved) return;

  await db
    .update(casesTable)
    .set({
      status: "queued",
      next_action_at: dueIn(STEP_DELAY.quotaRetry),
      locked_at: null,
      updated_at: new Date(),
      last_error: `Daily D&B quota reached for ${c.country_code}; waiting for capacity`,
    })
    .where(eq(casesTable.id, c.id));
}

// in_progress: simulate the terminal D&B outcome distribution.
async function runResolution(c: Case): Promise<void> {
  // Demo walkthrough: deliver the exact DUNS that was supplied up front.
  if (c.requested_duns) {
    await terminate(c, "closed_created", {
      duns_number: c.requested_duns,
      resolution_code: "DUNS_CREATED",
      closed_at: new Date(),
      attempts: 0,
      last_error: null,
    });
    return;
  }

  const roll = Math.random();
  if (roll < 0.9) {
    await terminate(c, "closed_created", {
      duns_number: generateDuns(),
      resolution_code: "DUNS_CREATED",
      closed_at: new Date(),
      attempts: 0,
      last_error: null,
    });
  } else if (roll < 0.95) {
    await terminate(c, "closed_failed", {
      resolution_code: "ADDRESS_UNVERIFIABLE",
      last_error: "D&B could not verify the registered business address.",
      closed_at: new Date(),
    });
  } else {
    await terminate(c, "challenged", {
      resolution_code: "MANUAL_REVIEW",
      last_error: "Multiple candidate matches found; manual review required.",
    });
  }
}

async function processCase(c: Case): Promise<void> {
  switch (c.status) {
    case "pending_match":
      return runMatch(c);
    case "queued":
      return runQuotaReserve(c);
    case "submitted":
      return advance(c, "received", STEP_DELAY.receive);
    case "received":
      return advance(c, "in_progress", STEP_DELAY.progress);
    case "in_progress":
      return runResolution(c);
    default:
      // Not an actionable state, so release the lease and leave it alone.
      await db
        .update(casesTable)
        .set({ locked_at: null })
        .where(eq(casesTable.id, c.id));
  }
}

async function handleCase(c: Case): Promise<void> {
  try {
    await processCase(c);
  } catch (err) {
    const attempts = (c.attempts ?? 0) + 1;
    const message = err instanceof Error ? err.message : String(err);
    const maxAttempts = c.max_attempts ?? 5;

    if (attempts >= maxAttempts) {
      await terminate(c, "error", {
        attempts,
        last_error: `Exhausted retries (${attempts}/${maxAttempts}): ${message}`,
        resolution_code: "PROCESSING_ERROR",
      });
      logger.error({ caseId: c.case_id, err }, "Case dead-lettered after max attempts");
      return;
    }

    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    await db
      .update(casesTable)
      .set({
        attempts,
        last_error: message,
        next_action_at: dueIn(backoff),
        locked_at: null,
        updated_at: new Date(),
      })
      .where(eq(casesTable.id, c.id));
    logger.warn(
      { caseId: c.case_id, attempts, backoffMs: backoff },
      "Case transition failed; scheduled retry",
    );
  }
}

async function tick(): Promise<void> {
  if (isTicking || stopped) return;
  isTicking = true;
  try {
    const due = await claimDueCases();
    for (const c of due) {
      if (stopped) break;
      await handleCase(c);
    }
  } catch (err) {
    logger.error({ err }, "Worker tick failed");
  } finally {
    isTicking = false;
  }
}

export function startWorker(): void {
  if (timer) return;
  stopped = false;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  logger.info({ tickMs: TICK_MS }, "DUNS durable worker started");
}

export function stopWorker(): void {
  stopped = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  logger.info("DUNS durable worker stopped");
}
