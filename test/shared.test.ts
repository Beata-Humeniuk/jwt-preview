import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHARED_WEBVIEW_FUNCTIONS, sharedWebviewSource } from '../src/shared';

// The shared functions reach the webview as source text, cut off from their
// modules. Evaluating that text in a fresh scope proves nothing is missing.
function loadInIsolation(): Record<string, (...args: unknown[]) => unknown> {
  const names = SHARED_WEBVIEW_FUNCTIONS.map(fn => fn.name);
  const factory = new Function(sharedWebviewSource() + '\nreturn { ' + names.join(', ') + ' };');
  return factory() as Record<string, (...args: unknown[]) => unknown>;
}

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSIsImV4cCI6MTcwMDAwMzYwMH0.sig';
const NOW = 1700000000;

test('every shared function has a name to export under', () => {
  for (const fn of SHARED_WEBVIEW_FUNCTIONS) {
    assert.ok(fn.name, 'anonymous functions cannot be referenced from the webview');
  }
});

test('shared functions work with no access to their modules', () => {
  const shared = loadInIsolation();

  const parsed = shared.parseToken(TOKEN) as { kind: string; headerStr: string; payloadStr: string };
  assert.equal(parsed.kind, 'ok');
  assert.deepEqual(JSON.parse(parsed.headerStr), { alg: 'HS256', typ: 'JWT' });

  const payload = JSON.parse(parsed.payloadStr) as Record<string, unknown>;
  assert.ok((shared.jsonToHtml(payload, '') as string).includes('alice'));
  assert.ok((shared.renderPlain(payload, NOW) as string).includes('Expires'));
  assert.ok((shared.renderClaims(payload, NOW) as string).includes('in 1 h'));
  assert.equal(shared.escapeHtml('<b>'), '&lt;b&gt;');
});

test('isolated output matches the in-process output', () => {
  const shared = loadInIsolation();
  for (const fn of SHARED_WEBVIEW_FUNCTIONS) {
    assert.equal(shared[fn.name].toString(), fn.toString());
  }
});
