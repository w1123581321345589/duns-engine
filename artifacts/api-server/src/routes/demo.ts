import { Router } from "express";
import { randomUUID } from "crypto";
import { createCaseRecord } from "../lib/cases-service";
import { resetDemoData } from "../lib/demo-data";

const router = Router();

// Server-side demo companies so the in-app "Simulate Atlas Webhook" button
// works without the browser ever holding the signing secret. A spread of
// countries exercises the per-country D&B quota limits.
const DEMO_COMPANIES = [
  {
    legal_name: "Acme Holdings Inc.",
    street_address: "651 N Broad St",
    city: "Middletown",
    state: "DE",
    postal_code: "19709",
    country_code: "US",
    founder_email: "founder@acmeholdings.example",
  },
  {
    legal_name: "Brightline Technologies Corp.",
    street_address: "1209 Orange St",
    city: "Wilmington",
    state: "DE",
    postal_code: "19801",
    country_code: "US",
    founder_email: "ceo@brightline.example",
  },
  {
    legal_name: "Vertex Systems Inc.",
    street_address: "2711 Centerville Rd",
    city: "Wilmington",
    state: "DE",
    postal_code: "19808",
    country_code: "US",
    founder_email: "ops@vertexsystems.example",
  },
  {
    legal_name: "Fjord Logistics AS",
    street_address: "Karl Johans gate 22",
    city: "Oslo",
    state: null,
    postal_code: "0026",
    country_code: "NO",
    founder_email: "post@fjordlogistics.example",
  },
  {
    legal_name: "Borsa Trading S.r.l.",
    street_address: "Via Roma 10",
    city: "Milano",
    state: null,
    postal_code: "20121",
    country_code: "IT",
    founder_email: "info@borsatrading.example",
  },
];

function demoEnabled(): boolean {
  return process.env.DEMO_MODE !== "false";
}

router.post("/v1/demo/simulate-webhook", async (req, res) => {
  if (!demoEnabled()) {
    res.status(403).json({ error: "Forbidden", message: "Demo mode is disabled" });
    return;
  }

  const company = DEMO_COMPANIES[Math.floor(Math.random() * DEMO_COMPANIES.length)];
  const companyId = `atlas_demo_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const { case: created } = await createCaseRecord(
      {
        business_name: company.legal_name,
        street_address: company.street_address,
        city: company.city,
        state: company.state,
        postal_code: company.postal_code,
        country_code: company.country_code,
        requestor_email: company.founder_email,
      },
      {
        source: "demo",
        sourceEventId: companyId,
        idempotencyKey: `demo:${companyId}`,
      },
    );

    res.json({
      case_id: created.case_id,
      status: created.status,
      message: "Simulated Atlas event accepted. Watch it move through the pipeline.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to simulate Atlas webhook");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to simulate webhook" });
  }
});

router.post("/v1/demo/run", async (req, res) => {
  if (!demoEnabled()) {
    res.status(403).json({ error: "Forbidden", message: "Demo mode is disabled" });
    return;
  }

  const rawDuns = typeof req.body?.duns_number === "string" ? req.body.duns_number : "";
  const dunsNumber = rawDuns.replace(/\D/g, "");
  if (dunsNumber.length !== 9) {
    res.status(400).json({
      error: "Bad Request",
      message: "duns_number must be a 9-digit number.",
    });
    return;
  }

  const rawName = typeof req.body?.business_name === "string" ? req.body.business_name.trim() : "";
  const businessName = rawName || "Live Demo Company";
  const runId = `demo_run_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const { case: created } = await createCaseRecord(
      {
        business_name: businessName,
        street_address: "548 Market St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94104",
        country_code: "US",
        requestor_email: "founder@livedemo.example",
        requested_duns: dunsNumber,
      },
      {
        source: "demo",
        sourceEventId: runId,
        idempotencyKey: `demo:${runId}`,
      },
    );

    res.json({
      case_id: created.case_id,
      status: created.status,
      message: `Live demo started. Watch DUNS ${dunsNumber} move through the pipeline.`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start live demo run");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to start demo run" });
  }
});

router.post("/v1/demo/reset", async (req, res) => {
  // This endpoint is destructive (wipes all cases + quota), so it is gated
  // behind the same demo-mode flag as the simulate-webhook route. It returns
  // 403 whenever demo mode is disabled to prevent anyone from wiping the data.
  if (!demoEnabled()) {
    res.status(403).json({ error: "Forbidden", message: "Demo mode is disabled" });
    return;
  }

  try {
    const result = await resetDemoData();
    res.json({
      ok: true,
      cases_seeded: result.cases_seeded,
      quota_seeded: result.quota_seeded,
      message: "Demo data reset. Cases and quota re-seeded.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to reset demo data");
    res
      .status(500)
      .json({ error: "Internal Server Error", message: "Failed to reset demo data" });
  }
});

export default router;
