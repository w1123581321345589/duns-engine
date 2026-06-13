import { Router } from "express";
import { db } from "@workspace/db";
import { casesTable } from "@workspace/db";
import { eq, count, avg, sql } from "drizzle-orm";

const router = Router();

router.get("/v1/metrics", async (req, res) => {
  try {
    const rows = await db
      .select({
        status: casesTable.status,
        cnt: count(),
      })
      .from(casesTable)
      .groupBy(casesTable.status);

    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.cnt)]));

    const total_requests = rows.reduce((s, r) => s + Number(r.cnt), 0);
    const pending = (byStatus["pending_match"] ?? 0) + (byStatus["queued"] ?? 0);
    const submitted = byStatus["submitted"] ?? 0;
    const in_progress = (byStatus["in_progress"] ?? 0) + (byStatus["received"] ?? 0);
    const completed_created = byStatus["closed_created"] ?? 0;
    const completed_exists = (byStatus["closed_exists"] ?? 0) + (byStatus["match_found"] ?? 0);
    const failed = (byStatus["closed_failed"] ?? 0) + (byStatus["error"] ?? 0);

    const total_closed = completed_created + completed_exists + failed;
    const success_rate =
      total_closed > 0
        ? Number(((completed_created + completed_exists) / total_closed * 100).toFixed(1))
        : 0;

    // average hours from created_at to closed_at for resolved cases
    const [avgResult] = await db
      .select({
        avg_hours: sql<string>`EXTRACT(EPOCH FROM AVG(closed_at - created_at)) / 3600`,
      })
      .from(casesTable)
      .where(sql`closed_at IS NOT NULL`);

    res.json({
      total_requests,
      pending,
      submitted,
      in_progress,
      completed_created,
      completed_exists,
      failed,
      avg_resolution_hours: avgResult?.avg_hours != null ? Number(parseFloat(String(avgResult.avg_hours)).toFixed(1)) : null,
      success_rate,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch metrics");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch metrics" });
  }
});

export default router;
