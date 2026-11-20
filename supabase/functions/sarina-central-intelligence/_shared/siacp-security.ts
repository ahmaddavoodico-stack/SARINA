import { isRecord } from "./sci-contract.ts";

export interface NonceStore {
  /** Must be atomic across all Edge Function instances. */
  consume(sender: string, nonce: string, expiresAt: number): Promise<boolean>;
}

function compareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Deterministic JSON encoding for the SIACP JSON data subset. */
export function canonicalizeSiacp(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("NON_CANONICAL_NUMBER");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalizeSiacp(item)).join(",") + "]";
  }
  if (!isRecord(value)) throw new Error("NON_CANONICAL_VALUE");
  const keys = Object.keys(value).sort();
  return "{" + keys.map((key) => {
    const item = value[key];
    if (item === undefined) throw new Error("UNDEFINED_CANONICAL_VALUE");
    return JSON.stringify(key) + ":" + canonicalizeSiacp(item);
  }).join(",") + "}";
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("SIGNING_KEY_TOO_SHORT");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSiacpEnvelope(
  envelope: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = envelope.header;
  if (!isRecord(header)) throw new Error("INVALID_SIACP_HEADER");
  const unsigned = { ...envelope, header: { ...header } };
  delete (unsigned.header as Record<string, unknown>).signature;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonicalizeSiacp(unsigned)),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifySignedSiacpTask(
  envelope: unknown,
  options: {
    signingKey: string;
    allowedSenders: ReadonlySet<string>;
    allowedRecipients: ReadonlySet<string>;
    nonceStore: NonceStore;
    now?: number;
  },
): Promise<{ ok: true; correlationId: string } | { ok: false; code: string }> {
  if (!isRecord(envelope) || !isRecord(envelope.header) || !isRecord(envelope.body)) {
    return { ok: false, code: "INVALID_SIACP_ENVELOPE" };
  }
  const h = envelope.header;
  const now = options.now ?? Date.now();
  if (h.protocol !== "SIACP/1.1" || h.type !== "TASK_REQUEST") {
    return { ok: false, code: "UNSUPPORTED_SIACP_MESSAGE" };
  }
  if (typeof h.sender !== "string" || !options.allowedSenders.has(h.sender)) {
    return { ok: false, code: "SIACP_SENDER_NOT_ALLOWED" };
  }
  if (typeof h.correlation_id !== "string" || !h.correlation_id.trim() ||
      typeof h.timestamp !== "string" || typeof h.nonce !== "string" ||
      typeof h.signature !== "string") {
    return { ok: false, code: "SIACP_AUTH_FIELDS_REQUIRED" };
  }
  if (!Array.isArray(h.recipients) || h.recipients.length === 0 ||
      !h.recipients.every((recipient) => typeof recipient === "string" &&
        options.allowedRecipients.has(recipient))) {
    return { ok: false, code: "SIACP_RECIPIENT_NOT_ALLOWED" };
  }
  if (!Number.isInteger(h.ttl_seconds) || Number(h.ttl_seconds) < 1 ||
      Number(h.ttl_seconds) > 900 || h.nonce.length < 16 || h.nonce.length > 64) {
    return { ok: false, code: "SIACP_TTL_OR_NONCE_INVALID" };
  }
  const timestamp = Date.parse(h.timestamp);
  if (!Number.isFinite(timestamp) || now - timestamp > Number(h.ttl_seconds) * 1000 ||
      timestamp - now > 60_000) {
    return { ok: false, code: "SIACP_MESSAGE_EXPIRED" };
  }
  let supplied: Uint8Array;
  try { supplied = base64UrlToBytes(h.signature); }
  catch { return { ok: false, code: "SIACP_SIGNATURE_INVALID" }; }
  const unsigned = { ...envelope, header: { ...h } };
  delete (unsigned.header as Record<string, unknown>).signature;
  try {
    const key = await importHmacKey(options.signingKey);
    const expected = new Uint8Array(await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(canonicalizeSiacp(unsigned)),
    ));
    if (!compareBytes(expected, supplied)) return { ok: false, code: "SIACP_SIGNATURE_INVALID" };
  } catch {
    return { ok: false, code: "SIACP_SIGNATURE_INVALID" };
  }
  const accepted = await options.nonceStore.consume(
    h.sender,
    h.nonce,
    timestamp + Number(h.ttl_seconds) * 1000,
  );
  if (!accepted) return { ok: false, code: "SIACP_REPLAY_DETECTED" };
  return { ok: true, correlationId: h.correlation_id };
}

/** Test-only implementation. Never use this for multi-instance production dispatch. */
export class InMemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();
  async consume(sender: string, nonce: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    for (const [key, expiry] of this.seen) if (expiry <= now) this.seen.delete(key);
    const key = sender + ":" + nonce;
    if (this.seen.has(key)) return false;
    this.seen.set(key, expiresAt);
    return true;
  }
}
