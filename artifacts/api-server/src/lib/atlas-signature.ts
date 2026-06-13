import crypto from "crypto";

// Stripe-style signed webhooks. The sender includes an `Atlas-Signature` header
// of the form `t=<unix-seconds>,v1=<hex>`, where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`).
// Requests outside this tolerance are rejected to limit replay attacks.
const TOLERANCE_SECONDS = 5 * 60;

export type SignatureResult =
  | { ok: true }
  | { ok: false; status: 400 | 401; reason: string };

export function parseSignatureHeader(header: string): { t?: string; v1?: string } {
  const out: { t?: string; v1?: string } = {};
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") out.t = value;
    else if (key === "v1") out.v1 = value;
  }
  return out;
}

export function computeAtlasSignature(
  timestamp: string,
  rawBody: string,
  secret: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function verifyAtlasSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignatureResult {
  if (!header) return { ok: false, status: 401, reason: "Missing Atlas-Signature header" };
  if (!rawBody || rawBody.length === 0) {
    return { ok: false, status: 400, reason: "Missing request body" };
  }

  const { t, v1 } = parseSignatureHeader(header);
  if (!t || !v1) return { ok: false, status: 400, reason: "Malformed signature header" };

  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, status: 400, reason: "Invalid timestamp" };
  if (Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { ok: false, status: 401, reason: "Signature timestamp outside tolerance" };
  }

  const expected = computeAtlasSignature(t, rawBody.toString("utf8"), secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(v1, "utf8");

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return { ok: false, status: 401, reason: "Signature mismatch" };
  }

  return { ok: true };
}
