import crypto from "crypto";

const SECRET = process.env.INVITE_LINK_SECRET;

function getKey() {
  if (!SECRET) {
    throw new Error("INVITE_LINK_SECRET is not configured");
  }
  return crypto.createHash("sha256").update(SECRET).digest();
}

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  return Buffer.from(base64 + (pad ? "=".repeat(4 - pad) : ""), "base64");
}

export function createInviteToken(email: string) {
  if (!SECRET) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toBase64Url(Buffer.concat([iv, tag, ciphertext]));
}

export function decodeInviteToken(token: string): string {
  if (!SECRET) {
    throw new Error("INVITE_LINK_SECRET is not configured");
  }
  const key = getKey();
  const raw = fromBase64Url(token);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
