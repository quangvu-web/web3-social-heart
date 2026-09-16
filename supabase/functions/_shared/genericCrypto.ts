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

async function encryptionKey(envName: string): Promise<CryptoKey> {
  const secret = Deno.env.get(envName) ?? "";
  if (!secret || secret.length < 32) {
    throw new Error(`${envName} must be configured with at least 32 characters`);
  }
  const hash = await crypto.subtle.digest("SHA-256", ENCODER.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string, envName: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(envName);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ENCODER.encode(value));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(encrypted: string, envName: string): Promise<string> {
  const [version, ivPart, dataPart] = encrypted.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Invalid encrypted secret");
  const key = await encryptionKey(envName);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return DECODER.decode(decrypted);
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", ENCODER.encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
