export type ParsedToken =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; headerStr: string; payloadStr: string; signature: string };

export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

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

export function jsonToHtml(value: unknown, keyHtml: string): string {
  if (value === null || typeof value !== 'object') {
    const isString = typeof value === 'string';
    const cls = isString ? 'jstr' : (typeof value === 'number' ? 'jnum' : 'jlit');
    const text = isString ? '"' + escapeHtml(value) + '"' : escapeHtml(String(value));
    return '<div class="jrow">' + keyHtml + '<span class="' + cls + '">' + text + '</span></div>';
  }
  const isArr = Array.isArray(value);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const entries: Array<[string | null, unknown]> = isArr
    ? (value as unknown[]).map(v => [null, v] as [null, unknown])
    : Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return '<div class="jrow">' + keyHtml + open + close + '</div>';
  }
  const inner = entries.map(([k, v]) =>
    jsonToHtml(v, k === null ? '' : '<span class="jkey">"' + escapeHtml(k) + '"</span>: ')
  ).join('');
  return '<details class="jnode" open>' +
    '<summary data-close="' + close + '">' + keyHtml + open + '</summary>' +
    '<div class="jkids">' + inner + '</div>' +
    '<div class="jrow">' + close + '</div>' +
    '</details>';
}

export function fmtDate(sec: number): string {
  try {
    const d = new Date(sec * 1000);
    return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  } catch (e) { return String(sec); }
}

export function fmtRel(sec: number, now: number): string {
  let d = sec - now;
  const future = d >= 0;
  d = Math.abs(d);
  let txt;
  if (d < 60) { txt = d + ' s'; }
  else if (d < 3600) { txt = Math.round(d / 60) + ' min'; }
  else if (d < 86400) { txt = Math.round(d / 3600) + ' h'; }
  else if (d < 31536000) {
    const days = Math.round(d / 86400);
    txt = days + (days === 1 ? ' day' : ' days');
  } else {
    const y = Math.round(d / 31536000);
    txt = y + (y === 1 ? ' year' : ' years');
  }
  return future ? 'in ' + txt : txt + ' ago';
}

export function renderClaims(payloadObj: Record<string, unknown>, now: number): string {
  const rows: string[] = [];

  function row(key: string, label: string, valueHtml: string): void {
    rows.push('<div class="claim-row"><span class="claim-key">' + key + '</span>' +
      '<span class="claim-name">' + label + '</span>' +
      '<span class="claim-val">' + valueHtml + '</span></div>');
  }
  function dateVal(sec: number): string {
    return fmtDate(sec) + ' <span class="claim-sub">(' + fmtRel(sec, now) + ')</span>';
  }

  if (typeof payloadObj.exp === 'number') {
    const expired = payloadObj.exp < now;
    row('exp', 'expires', dateVal(payloadObj.exp) +
      '<span class="pill ' + (expired ? 'err">expired' : 'ok">valid') + '</span>');
  }
  if (typeof payloadObj.iat === 'number') {
    row('iat', 'issued', dateVal(payloadObj.iat));
  }
  if (typeof payloadObj.nbf === 'number') {
    row('nbf', 'valid from', dateVal(payloadObj.nbf) +
      (payloadObj.nbf > now ? '<span class="pill warn">not yet active</span>' : ''));
  }
  if (payloadObj.iss !== undefined) { row('iss', 'issuer', escapeHtml(String(payloadObj.iss))); }
  if (payloadObj.sub !== undefined) { row('sub', 'subject', escapeHtml(String(payloadObj.sub))); }
  if (payloadObj.aud !== undefined) {
    row('aud', 'audience', escapeHtml(Array.isArray(payloadObj.aud) ? payloadObj.aud.join(', ') : String(payloadObj.aud)));
  }

  return rows.length ? '<div class="claims-box">' + rows.join('') + '</div>' : '';
}
