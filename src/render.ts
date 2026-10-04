// Every exported function here is also serialized into the webview, so each
// must stay self-contained — see SHARED_WEBVIEW_FUNCTIONS in shared.ts.

export function escapeHtml(s: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(s).replace(/[&<>"']/g, c => entities[c]);
}

export function jsonToHtml(value: unknown, keyHtml: string): string {
  function primitiveHtml(primitive: unknown): string {
    if (typeof primitive === 'string') {
      return '<span class="jstr">"' + escapeHtml(primitive) + '"</span>';
    }
    const cls = typeof primitive === 'number' ? 'jnum' : 'jlit';
    return '<span class="' + cls + '">' + escapeHtml(String(primitive)) + '</span>';
  }

  if (value === null || typeof value !== 'object') {
    return '<div class="jrow">' + keyHtml + primitiveHtml(value) + '</div>';
  }

  const isArray = Array.isArray(value);
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  const children: string[] = isArray
    ? (value as unknown[]).map(item => jsonToHtml(item, ''))
    : Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => jsonToHtml(item, '<span class="jkey">"' + escapeHtml(key) + '"</span>: '));

  if (children.length === 0) {
    return '<div class="jrow">' + keyHtml + open + close + '</div>';
  }
  return '<details class="jnode" open>' +
    '<summary data-close="' + close + '">' + keyHtml + open + '</summary>' +
    '<div class="jkids">' + children.join('') + '</div>' +
    '<div class="jrow">' + close + '</div>' +
    '</details>';
}

export function fmtDate(sec: number): string {
  try {
    return new Date(sec * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  } catch {
    return String(sec);
  }
}

export function fmtRel(sec: number, now: number): string {
  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const YEAR = 365 * DAY;

  const delta = sec - now;
  const distance = Math.abs(delta);
  let text: string;
  if (distance < MINUTE) {
    text = distance + ' s';
  } else if (distance < HOUR) {
    text = Math.round(distance / MINUTE) + ' min';
  } else if (distance < DAY) {
    text = Math.round(distance / HOUR) + ' h';
  } else if (distance < YEAR) {
    const days = Math.round(distance / DAY);
    text = days + (days === 1 ? ' day' : ' days');
  } else {
    const years = Math.round(distance / YEAR);
    text = years + (years === 1 ? ' year' : ' years');
  }
  return delta >= 0 ? 'in ' + text : text + ' ago';
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
  function dateRow(key: string, label: string): void {
    const value = payloadObj[key];
    if (typeof value === 'number') {
      row(key, label, fmtDate(value) + ' <span class="claim-sub">(' + fmtRel(value, now) + ')</span>' +
        claimValidityPill(key, value, now));
    }
  }
  function textRow(key: string, label: string): void {
    const value = payloadObj[key];
    if (value !== undefined) {
      row(key, label, escapeHtml(String(value)));
    }
  }

  dateRow('exp', 'expires');
  dateRow('iat', 'issued');
  dateRow('nbf', 'valid from');
  textRow('iss', 'issuer');
  textRow('sub', 'subject');
  const aud = payloadObj.aud;
  if (aud !== undefined) {
    row('aud', 'audience', escapeHtml(Array.isArray(aud) ? aud.join(', ') : String(aud)));
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
  const dateClaims = ['exp', 'iat', 'nbf'];

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

  function dateRow(label: string, key: string, sec: number): string {
    return row(label, escapeHtml(fmtDate(sec)) +
      ' <span class="psub">(' + escapeHtml(fmtRel(sec, now)) + ')</span>' + claimValidityPill(key, sec, now));
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
      if (topLevel && typeof v === 'number' && dateClaims.includes(k)) {
        return dateRow(label, k, v);
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
