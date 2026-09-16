const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STREAM_KEY_ENCRYPTION_SECRET") ?? "";
  if (!secret || secret.length < 32) {
    throw new Error("STREAM_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters");
  }
  const hash = await crypto.subtle.digest("SHA-256", ENCODER.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptStreamKey(streamKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ENCODER.encode(streamKey));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptStreamKey(encrypted: string): Promise<string> {
  const [version, ivPart, dataPart] = encrypted.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Invalid encrypted stream key");
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return DECODER.decode(decrypted);
}

export function maskStreamKey(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

