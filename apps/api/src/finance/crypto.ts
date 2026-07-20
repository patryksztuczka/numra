/**
 * AES-GCM encrypt/decrypt for sensitive values stored in D1.
 * ENCRYPTION_KEY must be a base64-encoded 32-byte key.
 */

function decodeKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  if (raw.byteLength !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Returns base64(iv || ciphertext). */
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const key = await decodeKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(payload: string, base64Key: string): Promise<string> {
  const key = await decodeKey(base64Key);
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
