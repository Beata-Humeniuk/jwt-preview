import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedWebviewSource } from '../src/webviewScript';

// The shared functions are embedded as source text into the webview, where there is
// no module system. Evaluating them with `new Function` reproduces that: any reference
// to `exports`, `require` or another module's binding throws a ReferenceError here.

test('shared webview source is self-contained and decodes end to end', () => {
  const source = sharedWebviewSource();
  assert.ok(!/\bexports\./.test(source), 'shared source must not reference exports');
  assert.ok(!/\brequire\(/.test(source), 'shared source must not reference require');
  assert.ok(!/\b\w+_1\./.test(source), 'shared source must not reference imported modules');

  const run = new Function('input', 'mime', source + `
    const normalized = normalizeBase64(input);
    if (normalized.kind !== 'ok') { return normalized; }
    const bytes = decodeBase64(normalized.base64);
    const info = detectContent(bytes, normalized.mimeHint);
    return {
      normalized,
      info,
      size: formatSize(bytes.length),
      hex: hexDump(bytes, 16),
      html: info.isJson ? jsonToHtml(JSON.parse(info.text), '') : escapeHtml(info.text || '')
    };
  `);

  const json = run(Buffer.from('{"hello":"<world>"}').toString('base64'));
  assert.equal(json.info.mime, 'application/json');
  assert.equal(json.info.isJson, true);
  assert.equal(json.size, '19 B');
  assert.ok(json.html.includes('&lt;world&gt;'));
  assert.ok(json.hex.startsWith('00000000  7b 22'));

  const png = run('data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString('base64'));
  assert.equal(png.normalized.fromDataUri, true);
  assert.equal(png.info.kind, 'image');
  assert.equal(png.info.extension, 'png');

  assert.equal(run('not base64!').kind, 'invalid');
});
