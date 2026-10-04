export type ParsedToken =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; headerStr: string; payloadStr: string; signature: string };

// A JWT has a header and a payload, plus an optional signature segment.
export function splitSegments(raw: string): string[] | undefined {
  const segments = raw.trim().split('.');
  return segments.length === 2 || segments.length === 3 ? segments : undefined;
}

export function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseToken(raw: string): ParsedToken {
  if (!raw.trim()) {
    return { kind: 'empty' };
  }
  const segments = splitSegments(raw);
  if (!segments) {
    return { kind: 'invalid' };
  }
  try {
    return {
      kind: 'ok',
      headerStr: base64UrlDecode(segments[0]),
      payloadStr: base64UrlDecode(segments[1]),
      signature: segments[2] || ''
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]*)?$/;

export function looksLikeJwt(text: string): boolean {
  return JWT_SHAPE.test(text.trim());
}
