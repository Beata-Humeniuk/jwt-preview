export type NormalizedBase64 =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ok'; base64: string; mimeHint?: string; urlSafe: boolean; fromDataUri: boolean };

/**
 * Turns whatever the user pasted into canonical, padded, standard-alphabet Base64.
 *
 * Accepts a bare Base64 string, a `data:` URI, text wrapped in quotes, the URL-safe
 * alphabet, MIME-style line wrapping, and missing padding. Reports the first problem
 * it finds in plain words when the text cannot be Base64.
 */
export function normalizeBase64(raw: string): NormalizedBase64 {
  let text = raw.trim();
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    text = text.slice(1, -1).trim();
  }
  if (!text) {
    return { kind: 'empty' };
  }

  let mimeHint: string | undefined;
  let fromDataUri = false;
  const dataUri = /^data:([^,]*),/i.exec(text);
  if (dataUri) {
    const params = dataUri[1].split(';');
    if (!params.slice(1).some(p => p.trim().toLowerCase() === 'base64')) {
      return { kind: 'invalid', message: 'This data: URI has no ";base64" marker, so its content is not Base64-encoded.' };
    }
    fromDataUri = true;
    const mediaType = params[0].trim().toLowerCase();
    mimeHint = mediaType || undefined;
    text = text.slice(dataUri[0].length);
  }

  text = text.replace(/\s+/g, '');
  if (!text) {
    return fromDataUri
      ? { kind: 'invalid', message: 'The data: URI carries no content after the comma.' }
      : { kind: 'empty' };
  }

  const urlSafe = /[-_]/.test(text);
  if (urlSafe && /[+/]/.test(text)) {
    return { kind: 'invalid', message: 'The text mixes the standard (+ /) and URL-safe (- _) Base64 alphabets.' };
  }
  let s = urlSafe ? text.replace(/-/g, '+').replace(/_/g, '/') : text;
  s = s.replace(/=+$/, '');

  const bad = /[^A-Za-z0-9+/]/.exec(s);
  if (bad) {
    return bad[0] === '='
      ? { kind: 'invalid', message: 'Padding ("=") appears in the middle of the text; it is only allowed at the end.' }
      : { kind: 'invalid', message: 'Character "' + bad[0] + '" is not valid in Base64.' };
  }
  if (s.length % 4 === 1) {
    return { kind: 'invalid', message: 'The length is wrong for Base64: one character is left over after the last group of four.' };
  }
  while (s.length % 4) { s += '='; }

  return { kind: 'ok', base64: s, mimeHint, urlSafe, fromDataUri };
}

/** Decodes canonical Base64 (as produced by normalizeBase64) into raw bytes. */
export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
  return bytes;
}

/**
 * A conservative guess used only to decide whether clipboard text is worth decoding
 * automatically. Prose with spaces, short words, identifiers made of one character
 * class, and anything that fails normalisation are rejected.
 */
export function looksLikeBase64(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = normalizeBase64(trimmed);
  if (normalized.kind !== 'ok') {
    return false;
  }
  if (normalized.fromDataUri) {
    return true;
  }
  if (/[ \t]/.test(trimmed)) {
    return false;
  }
  const body = normalized.base64.replace(/=+$/, '');
  return body.length >= 16 && /[a-z]/.test(body) && /[A-Z0-9+/]/.test(body);
}
