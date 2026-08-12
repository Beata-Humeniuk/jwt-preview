export type ParsedToken =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; headerStr: string; payloadStr: string; signature: string };

export function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) { s += '='; }
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseToken(raw: string): ParsedToken {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: 'empty' };
  }
  const parts = trimmed.split('.');
  if (parts.length < 2 || parts.length > 3) {
    return { kind: 'invalid' };
  }
  try {
    return {
      kind: 'ok',
      headerStr: base64UrlDecode(parts[0]),
      payloadStr: base64UrlDecode(parts[1]),
      signature: parts[2] || ''
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
