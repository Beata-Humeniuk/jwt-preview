import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  base64UrlDecode,
  escapeHtml,
  fmtDate,
  fmtRel,
  jsonToHtml,
  parseToken,
  renderClaims
} from '../src/webviewLogic';

function b64url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function makeToken(header: object, payload: object, signature?: string): string {
  const parts = [b64url(JSON.stringify(header)), b64url(JSON.stringify(payload))];
  if (signature !== undefined) {
    parts.push(signature);
  }
  return parts.join('.');
}

const NOW = 1700000000;

test('valid three-part token decodes header, payload, and signature', () => {
  const token = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'test-user' }, 'c2lnbmF0dXJl');
  const parsed = parseToken(token);
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') {
    assert.deepEqual(JSON.parse(parsed.headerStr), { alg: 'HS256', typ: 'JWT' });
    assert.deepEqual(JSON.parse(parsed.payloadStr), { sub: 'test-user' });
    assert.equal(parsed.signature, 'c2lnbmF0dXJl');
  }
});

test('valid two-part token has empty signature', () => {
  const parsed = parseToken(makeToken({ alg: 'none' }, { sub: 'x' }));
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') {
    assert.equal(parsed.signature, '');
  }
});

test('base64url padding variants decode correctly', () => {
  for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
    assert.equal(base64UrlDecode(b64url(value)), value);
  }
});

test('base64url uses URL-safe alphabet', () => {
  const value = 'ÿþ??>>';
  const encoded = b64url(value);
  assert.equal(base64UrlDecode(encoded), value);
});

test('UTF-8 and non-Latin characters decode correctly', () => {
  const payload = { name: 'Żółć 日本語 한국어 中文 🙂' };
  const parsed = parseToken(makeToken({ alg: 'none' }, payload));
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') {
    assert.deepEqual(JSON.parse(parsed.payloadStr), payload);
  }
});

test('malformed base64url reports a graceful error', () => {
  const parsed = parseToken('!!!.@@@');
  assert.equal(parsed.kind, 'error');
  if (parsed.kind === 'error') {
    assert.equal(typeof parsed.message, 'string');
  }
});

test('invalid JSON in payload still decodes to a string without throwing', () => {
  const parsed = parseToken(b64url('{"alg":"none"}') + '.' + b64url('not json at all'));
  assert.equal(parsed.kind, 'ok');
  if (parsed.kind === 'ok') {
    assert.equal(parsed.payloadStr, 'not json at all');
    assert.throws(() => JSON.parse(parsed.payloadStr));
  }
});

test('empty and whitespace-only input is reported as empty', () => {
  assert.equal(parseToken('').kind, 'empty');
  assert.equal(parseToken('   \n\t ').kind, 'empty');
});

test('too few or too many dot-separated parts is invalid', () => {
  assert.equal(parseToken('justonepart').kind, 'invalid');
  assert.equal(parseToken('a.b.c.d').kind, 'invalid');
});

test('large payload renders without hanging', () => {
  const large: Record<string, string> = {};
  for (let i = 0; i < 2000; i++) {
    large['key' + i] = 'value-' + i;
  }
  const html = jsonToHtml(large, '');
  assert.ok(html.includes('key1999'));
  assert.ok(html.includes('value-1999'));
});

test('exp in the past renders expired pill, in the future renders valid pill', () => {
  const expired = renderClaims({ exp: NOW - 60 }, NOW);
  assert.ok(expired.includes('err'));
  assert.ok(expired.includes('expired'));
  const valid = renderClaims({ exp: NOW + 3600 }, NOW);
  assert.ok(valid.includes('ok'));
  assert.ok(valid.includes('valid'));
});

test('iat and nbf render, future nbf gets a warning pill', () => {
  const html = renderClaims({ iat: NOW - 100, nbf: NOW + 100 }, NOW);
  assert.ok(html.includes('iat'));
  assert.ok(html.includes('nbf'));
  assert.ok(html.includes('not yet active'));
  const active = renderClaims({ nbf: NOW - 100 }, NOW);
  assert.ok(!active.includes('not yet active'));
});

test('absent optional claims produce no claim rows', () => {
  assert.equal(renderClaims({ custom: 'x' }, NOW), '');
});

test('aud renders both string and array forms', () => {
  const single = renderClaims({ aud: 'api' }, NOW);
  assert.ok(single.includes('api'));
  const multi = renderClaims({ aud: ['api', 'web'] }, NOW);
  assert.ok(multi.includes('api, web'));
});

test('HTML injection in JSON keys and values is escaped', () => {
  const evil = {
    '<img src=x onerror=alert(1)>': '<script>alert(2)</script>',
    nested: { '"><svg onload=alert(3)>': "'-alert(4)-'" }
  };
  const html = jsonToHtml(evil, '');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<svg'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('HTML injection in claim values is escaped', () => {
  const html = renderClaims({
    iss: '<script>alert(1)</script>',
    sub: '"><b>x</b>',
    aud: ['<i>a</i>', 'b']
  }, NOW);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>'));
  assert.ok(!html.includes('<i>'));
});

test('escapeHtml escapes all special characters', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('fmtDate formats epoch seconds as UTC', () => {
  assert.equal(fmtDate(0), '1970-01-01 00:00:00 UTC');
});

test('relative time respects direction, units, and pluralization', () => {
  assert.equal(fmtRel(NOW + 30, NOW), 'in 30 s');
  assert.equal(fmtRel(NOW - 120, NOW), '2 min ago');
  assert.equal(fmtRel(NOW + 86400, NOW), 'in 1 day');
  assert.equal(fmtRel(NOW + 3 * 86400, NOW), 'in 3 days');
  assert.equal(fmtRel(NOW - 31536000, NOW), '1 year ago');
  assert.equal(fmtRel(NOW - 2 * 31536000, NOW), '2 years ago');
});
