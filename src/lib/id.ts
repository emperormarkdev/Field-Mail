export function newId(): string {
  const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  // Fallback for older Safari / insecure contexts.
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Short human-friendly reference shown in emails and on the PDF footer. */
export function shortRef(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}
