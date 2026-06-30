/** Convert ArrayBuffer to hex string */
export function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Parse hex string to Uint8Array */
export function bytesFromHex(s: string): Uint8Array {
  const h = s.replace(/\s/g, "");
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Convert ArrayBuffer to Base64 string */
export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Parse Base64 string to Uint8Array */
export function bytesFromBase64(s: string): Uint8Array {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Safely extract error message from unknown */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
