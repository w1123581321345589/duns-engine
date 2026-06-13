import "http";

// express.json({ verify }) captures the exact raw bytes so webhook signatures
// can be verified against the unparsed body. Augmenting IncomingMessage covers
// both the verify callback and Express's Request (which extends it).
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}
