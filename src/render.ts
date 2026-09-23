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

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const text = value < 10 ? value.toFixed(1).replace(/\.0$/, '') : String(Math.round(value));
  return text + ' ' + units[unit];
}

/** Classic 16-bytes-per-line hex dump of at most `maxBytes` bytes. */
export function hexDump(bytes: Uint8Array, maxBytes: number): string {
  const end = Math.min(bytes.length, maxBytes);
  const lines: string[] = [];
  for (let offset = 0; offset < end; offset += 16) {
    const lineEnd = Math.min(offset + 16, end);
    let hex = '';
    let ascii = '';
    for (let i = 0; i < 16; i++) {
      const at = offset + i;
      if (at < lineEnd) {
        const b = bytes[at];
        hex += (b < 16 ? '0' : '') + b.toString(16) + ' ';
        ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';
      } else {
        hex += '   ';
      }
      if (i === 7) { hex += ' '; }
    }
    lines.push(offset.toString(16).padStart(8, '0') + '  ' + hex + ' |' + ascii + '|');
  }
  return lines.join('\n');
}
