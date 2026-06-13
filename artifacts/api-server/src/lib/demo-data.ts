import { db } from "@workspace/db";
import { casesTable, quotaUsageTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

export const DEMO_CASES = [
  {
    business_name: "Meridian Labs Inc.",
    street_address: "450 Townsend St, Suite 200",
    city: "San Francisco",
    state: "CA",
    postal_code: "94107",
    country_code: "US",
    status: "closed_created" as const,
    duns_number: "078041207",
    match_confidence: 9,
    closed_at: new Date(Date.now() - 2 * 3600 * 1000),
  },
  {
    business_name: "Helix Ventures Ltd.",
    street_address: "1 Canada Square",
    city: "London",
    state: null,
    postal_code: "E14 5AB",
    country_code: "GB",
    status: "closed_exists" as const,
    duns_number: "219509450",
    match_confidence: 10,
    closed_at: new Date(Date.now() - 5 * 3600 * 1000),
  },
  {
    business_name: "Prism Analytics GmbH",
    street_address: "Unter den Linden 10",
    city: "Berlin",
    state: null,
    postal_code: "10117",
    country_code: "DE",
    status: "in_progress" as const,
    duns_number: null,
    match_confidence: null,
    closed_at: null,
  },
  {
    business_name: "Sakura Cloud K.K.",
    street_address: "2-2-1 Otemachi",
    city: "Tokyo",
    state: null,
    postal_code: "100-0004",
    country_code: "JP",
    status: "submitted" as const,
    duns_number: null,
    match_confidence: 3,
    closed_at: null,
  },
  {
    business_name: "Volta Energy S.r.l.",
    street_address: "Via della Conciliazione 4",
    city: "Rome",
    state: null,
    postal_code: "00193",
    country_code: "IT",
    status: "queued" as const,
    duns_number: null,
    match_confidence: null,
    closed_at: null,
  },
  {
    business_name: "Cascade Systems LLC",
    street_address: "720 Olive Way, Floor 12",
    city: "Seattle",
    state: "WA",
    postal_code: "98101",
    country_code: "US",
    status: "closed_created" as const,
    duns_number: "361289054",
    match_confidence: 8,
    closed_at: new Date(Date.now() - 1 * 3600 * 1000),
  },
  {
    business_name: "Argent Capital Partners LP",
    street_address: "499 Park Avenue, 23rd Floor",
    city: "New York",
    state: "NY",
    postal_code: "10022",
    country_code: "US",
    status: "pending_match" as const,
    duns_number: null,
    match_confidence: null,
    closed_at: null,
  },
  {
    business_name: "Fjord Digital AS",
    street_address: "Drammensveien 60",
    city: "Oslo",
    state: null,
    postal_code: "0271",
    country_code: "NO",
    status: "received" as const,
    duns_number: null,
    match_confidence: 5,
    closed_at: null,
  },
  {
    business_name: "Quantum Edge Pte. Ltd.",
    street_address: "One Raffles Quay, Level 30",
    city: "Singapore",
    state: null,
    postal_code: "048583",
    country_code: "SG",
    status: "closed_created" as const,
    duns_number: "654901832",
    match_confidence: 9,
    closed_at: new Date(Date.now() - 8 * 3600 * 1000),
  },
  {
    business_name: "Drift Financial Technologies Inc.",
    street_address: "2035 Sunset Lake Rd, Suite B-2",
    city: "Newark",
    state: "DE",
    postal_code: "19702",
    country_code: "US",
    status: "error" as const,
    duns_number: null,
    match_confidence: 2,
    closed_at: null,
  },
];

export const QUOTA_SEED = [
  { country_code: "US", used: 18, limit: 25 },
  { country_code: "GB", used: 11, limit: 25 },
  { country_code: "DE", used: 6, limit: 25 },
  { country_code: "JP", used: 4, limit: 25 },
  { country_code: "IT", used: 3, limit: 5 },
];

export interface SeedResult {
  cases_seeded: number;
  quota_seeded: number;
}

/**
 * Inserts the demo cases and quota rows. Uses onConflictDoNothing so it is safe
 * to run against an already-populated table.
 */
export async function seedDemoData(
  log?: (msg: string) => void,
): Promise<SeedResult> {
  const today = new Date().toISOString().split("T")[0];

  for (const c of DEMO_CASES) {
    const caseId = randomUUID();
    const createdAt = new Date(Date.now() - Math.random() * 24 * 3600 * 1000);
    await db
      .insert(casesTable)
      .values({
        case_id: caseId,
        status: c.status,
        duns_number: c.duns_number ?? null,
        business_name: c.business_name,
        street_address: c.street_address,
        city: c.city,
        state: c.state ?? null,
        postal_code: c.postal_code ?? null,
        country_code: c.country_code,
        match_confidence: c.match_confidence ?? null,
        created_at: createdAt,
        updated_at: new Date(),
        closed_at: c.closed_at ?? null,
      })
      .onConflictDoNothing();
    log?.(`  + ${c.business_name} (${c.status})`);
  }

  for (const q of QUOTA_SEED) {
    await db
      .insert(quotaUsageTable)
      .values({
        country_code: q.country_code,
        research_type: "Mini",
        date: today,
        used: q.used,
        limit: q.limit,
      })
      .onConflictDoNothing();
    log?.(`  quota: ${q.country_code} ${q.used}/${q.limit}`);
  }

  return { cases_seeded: DEMO_CASES.length, quota_seeded: QUOTA_SEED.length };
}

/**
 * Wipes all cases and quota usage, then re-seeds the demo dataset so every demo
 * starts from a clean slate.
 */
export async function resetDemoData(
  log?: (msg: string) => void,
): Promise<SeedResult> {
  log?.("Wiping cases and quota_usage...");
  await db.execute(sql`TRUNCATE TABLE ${casesTable} RESTART IDENTITY CASCADE`);
  await db.execute(
    sql`TRUNCATE TABLE ${quotaUsageTable} RESTART IDENTITY CASCADE`,
  );
  return seedDemoData(log);
}
