/**
 * Web Crypto API helpers (crypto.subtle) for client-side checksums & session fingerprints.
 * Note: Never used for scholar-number hashing or identity verification.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback deterministic non-crypto hex if subtle unavailable in restricted context
    const bytes = new Uint8Array(buffer);
    let h = 2166136261;
    for (let i = 0; i < Math.min(bytes.length, 4096); i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const digest = await window.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Text(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  return sha256Hex(encoded.buffer);
}

/**
 * Generates an RFC 4122 UUIDv4 safe for Postgres `uuid` columns even on non-HTTPS LAN URLs.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
