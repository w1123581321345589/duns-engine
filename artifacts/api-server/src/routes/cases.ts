import { Router } from "express";
import { db, casesTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { GetCasesQueryParams, CreateCaseBody } from "@workspace/api-zod";
import { createCaseRecord } from "../lib/cases-service";

const router = Router();

router.get("/v1/cases", async (req, res) => {
  const parsed = GetCasesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: "Invalid query parameters" });
    return;
  }

  const { status, limit = 50, offset = 0 } = parsed.data;

  try {
    const conditions = status ? [eq(casesTable.status, status)] : [];

    const [cases, totalResult] = await Promise.all([
      db
        .select()
        .from(casesTable)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(casesTable.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(casesTable)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    res.json({
      cases,
      total: totalResult[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list cases");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch cases" });
  }
});

router.post("/v1/cases", async (req, res) => {
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Unprocessable Entity", message: "Validation failed" });
    return;
  }

  const rawKey = req.headers["idempotency-key"];
  const idempotencyKey =
    typeof rawKey === "string" && rawKey.trim().length > 0 ? rawKey.trim() : undefined;

  try {
    const { case: created, deduped } = await createCaseRecord(parsed.data, {
      source: "api",
      idempotencyKey,
    });

    res.status(deduped ? 200 : 201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create case");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create case" });
  }
});

router.get("/v1/cases/:caseId", async (req, res) => {
  const { caseId } = req.params;

  try {
    const [found] = await db
      .select()
      .from(casesTable)
      .where(eq(casesTable.case_id, caseId))
      .limit(1);

    if (!found) {
      res.status(404).json({ error: "Not Found", message: "Case not found" });
      return;
    }

    res.json(found);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch case");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch case" });
  }
});

export default router;
