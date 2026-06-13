import { Router } from "express";
import { AtlasWebhookBody } from "@workspace/api-zod";
import { verifyAtlasSignature } from "../lib/atlas-signature";
import { createCaseRecord } from "../lib/cases-service";

const router = Router();

router.post("/v1/webhook/atlas", async (req, res) => {
  const secret = process.env.ATLAS_WEBHOOK_SECRET;

  // Production must have a signing secret; refuse to accept unverifiable traffic.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      req.log.error("ATLAS_WEBHOOK_SECRET is not configured");
      res.status(503).json({
        error: "Service Unavailable",
        message: "Webhook signing secret is not configured",
      });
      return;
    }
    // Locally, the supported way to exercise the pipeline without a secret is the
    // demo endpoint (/v1/demo/simulate-webhook). The real webhook still requires
    // a verifiable signature.
    res.status(401).json({
      error: "Unauthorized",
      message:
        "Webhook signature required. Set ATLAS_WEBHOOK_SECRET, or use /v1/demo/simulate-webhook for demos.",
    });
    return;
  }

  const signatureHeader = req.headers["atlas-signature"];
  const verdict = verifyAtlasSignature(
    req.rawBody,
    typeof signatureHeader === "string" ? signatureHeader : undefined,
    secret,
  );
  if (!verdict.ok) {
    res.status(verdict.status).json({
      error: verdict.status === 400 ? "Bad Request" : "Unauthorized",
      message: verdict.reason,
    });
    return;
  }

  const parsed = AtlasWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Unprocessable Entity", message: "Validation failed" });
    return;
  }

  const {
    company_id,
    legal_name,
    street_address,
    city,
    state,
    postal_code,
    country_code = "US",
    founder_email,
  } = parsed.data;

  try {
    const { case: created, deduped } = await createCaseRecord(
      {
        business_name: legal_name,
        street_address,
        city,
        state: state ?? null,
        postal_code: postal_code ?? null,
        country_code,
        requestor_email: founder_email ?? null,
      },
      {
        source: "atlas",
        sourceEventId: company_id,
        idempotencyKey: `atlas:${company_id}`,
      },
    );

    res.json({
      case_id: created.case_id,
      status: created.status,
      message: deduped
        ? "Event already processed. Returning the existing case."
        : "Match check + submission in progress.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to handle Atlas webhook");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to process webhook" });
  }
});

export default router;
