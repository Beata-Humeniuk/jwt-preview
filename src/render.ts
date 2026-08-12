export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
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

export function claimValidityPill(key: string, value: number, now: number): string {
  if (key === 'exp') {
    return value < now ? '<span class="pill err">expired</span>' : '<span class="pill ok">valid</span>';
  }
  if (key === 'nbf' && value > now) {
    return '<span class="pill warn">not yet active</span>';
  }
  return '';
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
    row('exp', 'expires', dateVal(payloadObj.exp) + claimValidityPill('exp', payloadObj.exp, now));
  }
  if (typeof payloadObj.iat === 'number') {
    row('iat', 'issued', dateVal(payloadObj.iat));
  }
  if (typeof payloadObj.nbf === 'number') {
    row('nbf', 'valid from', dateVal(payloadObj.nbf) + claimValidityPill('nbf', payloadObj.nbf, now));
  }
  if (payloadObj.iss !== undefined) { row('iss', 'issuer', escapeHtml(String(payloadObj.iss))); }
  if (payloadObj.sub !== undefined) { row('sub', 'subject', escapeHtml(String(payloadObj.sub))); }
  if (payloadObj.aud !== undefined) {
    row('aud', 'audience', escapeHtml(Array.isArray(payloadObj.aud) ? payloadObj.aud.join(', ') : String(payloadObj.aud)));
  }

  return rows.length ? '<div class="claims-box">' + rows.join('') + '</div>' : '';
}

export function renderPlain(value: unknown, now: number): string {
  const friendlyNames: Record<string, string> = {
    alg: 'Algorithm',
    typ: 'Type',
    kid: 'Key ID',
    cty: 'Content type',
    iss: 'Issuer',
    sub: 'Subject',
    aud: 'Audience',
    exp: 'Expires',
    iat: 'Issued at',
    nbf: 'Valid from',
    jti: 'Token ID'
  };

  function fmtValue(v: unknown): string {
    if (v === null || v === undefined) { return '—'; }
    if (typeof v === 'boolean') { return v ? 'yes' : 'no'; }
    return String(v);
  }

  function row(label: string, valueHtml: string): string {
    return '<div class="prow"><span class="pkey">' + escapeHtml(label) + '</span>' +
      '<span class="pval">' + valueHtml + '</span></div>';
  }

  function group(label: string, innerHtml: string): string {
    return '<details class="pnode" open><summary><span class="pkey">' + escapeHtml(label) + '</span></summary>' +
      '<div class="pkids">' + innerHtml + '</div></details>';
  }

  function isPrimitive(v: unknown): boolean {
    return v === null || typeof v !== 'object';
  }

  function renderEntries(obj: unknown, topLevel: boolean): string {
    if (isPrimitive(obj)) {
      return row('value', escapeHtml(fmtValue(obj)));
    }
    const entries: Array<[string, unknown]> = Array.isArray(obj)
      ? obj.map((v, i) => [String(i + 1), v] as [string, unknown])
      : Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {
      return '<div class="prow"><span class="psub">(empty)</span></div>';
    }
    return entries.map(([k, v]) => {
      const label = topLevel ? (friendlyNames[k] || k) : k;
      if (topLevel && typeof v === 'number' && (k === 'exp' || k === 'iat' || k === 'nbf')) {
        return row(label, escapeHtml(fmtDate(v)) +
          ' <span class="psub">(' + escapeHtml(fmtRel(v, now)) + ')</span>' + claimValidityPill(k, v, now));
      }
      if (Array.isArray(v) && v.every(isPrimitive)) {
        return row(label, escapeHtml(v.map(fmtValue).join(', ')));
      }
      if (!isPrimitive(v)) {
        return group(label, renderEntries(v, false));
      }
      return row(label, escapeHtml(fmtValue(v)));
    }).join('');
  }

  return renderEntries(value, true);
}
