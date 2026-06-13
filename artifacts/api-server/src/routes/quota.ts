import { Router } from "express";
import { db, quotaUsageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { quotaLimitFor } from "../lib/quota-limits";

const router = Router();

router.get("/v1/quota", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  try {
    const rows = await db
      .select()
      .from(quotaUsageTable)
      .where(eq(quotaUsageTable.date, today));

    const result = rows.map((r) => {
      const limit = quotaLimitFor(r.country_code);
      return {
        country_code: r.country_code,
        research_type: r.research_type,
        date: r.date,
        used: r.used,
        limit,
        remaining: Math.max(0, limit - r.used),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quota");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch quota" });
  }
});

export default router;
