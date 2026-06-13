import { db, casesTable, type Case } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface CreateCaseInput {
  business_name: string;
  street_address: string;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string;
  phone?: string | null;
  requestor_email?: string | null;
  requested_duns?: string | null;
}

export interface CreateCaseOptions {
  source: "api" | "atlas" | "demo";
  idempotencyKey?: string | null;
  sourceEventId?: string | null;
}

export interface CreateCaseResult {
  case: Case;
  deduped: boolean;
}

/**
 * Create a case, enforcing idempotency when an idempotency key is supplied.
 *
 * Re-sending the same key (e.g. a retried Atlas webhook or a client retry)
 * returns the original case instead of creating a duplicate or burning quota.
 * New cases are inserted with next_action_at=now() so the durable worker
 * picks them up immediately.
 */
export async function createCaseRecord(
  input: CreateCaseInput,
  options: CreateCaseOptions,
): Promise<CreateCaseResult> {
  const values = {
    case_id: randomUUID(),
    status: "pending_match" as const,
    business_name: input.business_name,
    street_address: input.street_address,
    city: input.city,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    country_code: input.country_code ?? "US",
    phone: input.phone ?? null,
    requestor_email: input.requestor_email ?? null,
    requested_duns: input.requested_duns ?? null,
    source: options.source,
    source_event_id: options.sourceEventId ?? null,
    idempotency_key: options.idempotencyKey ?? null,
    next_action_at: new Date(),
  };

  if (options.idempotencyKey) {
    const [inserted] = await db
      .insert(casesTable)
      .values(values)
      .onConflictDoNothing({ target: casesTable.idempotency_key })
      .returning();

    if (inserted) return { case: inserted, deduped: false };

    const [existing] = await db
      .select()
      .from(casesTable)
      .where(eq(casesTable.idempotency_key, options.idempotencyKey))
      .limit(1);

    if (existing) return { case: existing, deduped: true };

    // Pathological state: the insert reported a conflict on the unique
    // idempotency key, yet no matching row is visible. Re-inserting the same
    // key would only violate the constraint, so surface a clear error instead.
    throw new Error(
      `Idempotency conflict for key "${options.idempotencyKey}" but no matching case was found`,
    );
  }

  const [inserted] = await db.insert(casesTable).values(values).returning();
  return { case: inserted, deduped: false };
}
