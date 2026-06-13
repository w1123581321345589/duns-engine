import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { quotaLimitFor } from "./quota-limits";

const RESEARCH_TYPE = "Mini";

// Accepts either the base db or a transaction handle so the reservation can be
// committed atomically with the case status transition that depends on it.
type QuotaExecutor = Pick<typeof db, "execute">;

/**
 * Atomically reserve one unit of today's D&B quota for a country.
 *
 * Uses a single INSERT .. ON CONFLICT .. DO UPDATE .. WHERE statement so the
 * check-and-increment is race-safe under concurrency:
 *  - first request for the country/day inserts used=1 and returns a row,
 *  - subsequent requests increment only while used < limit and return a row,
 *  - once the cap is hit the WHERE fails, nothing is updated, no row returns.
 *
 * Returns true when a unit was reserved, false when the daily cap is reached.
 */
export async function reserveQuota(
  countryCode: string,
  executor: QuotaExecutor = db,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const limit = quotaLimitFor(countryCode);

  const result = await executor.execute(
    sql`INSERT INTO quota_usage (country_code, research_type, date, used, "limit")
        VALUES (${countryCode}, ${RESEARCH_TYPE}, ${today}, 1, ${limit})
        ON CONFLICT (country_code, date, research_type)
        DO UPDATE SET used = quota_usage.used + 1, "limit" = ${limit}
        WHERE quota_usage.used < ${limit}
        RETURNING used`,
  );

  return (result.rowCount ?? 0) > 0;
}
