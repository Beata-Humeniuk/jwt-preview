import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimValidityPill, escapeHtml, fmtDate, fmtRel, jsonToHtml, renderClaims, renderPlain } from '../src/render';

const NOW = 1700000000;

test('claimValidityPill covers exp and nbf, ignores other keys', () => {
  assert.ok(claimValidityPill('exp', NOW - 1, NOW).includes('expired'));
  assert.ok(claimValidityPill('exp', NOW + 1, NOW).includes('valid'));
  assert.ok(claimValidityPill('nbf', NOW + 1, NOW).includes('not yet active'));
  assert.equal(claimValidityPill('nbf', NOW - 1, NOW), '');
  assert.equal(claimValidityPill('iat', NOW, NOW), '');
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

test('plain view maps known claims to friendly labels', () => {
  const html = renderPlain({ iss: 'https://auth.example.com', sub: 'user-42', alg: 'HS256' }, NOW);
  assert.ok(html.includes('Issuer'));
  assert.ok(html.includes('Subject'));
  assert.ok(html.includes('Algorithm'));
  assert.ok(html.includes('https://auth.example.com'));
});

test('plain view formats top-level timestamp claims as dates', () => {
  const html = renderPlain({ exp: NOW + 3600 }, NOW);
  assert.ok(html.includes('Expires'));
  assert.ok(html.includes(fmtDate(NOW + 3600)));
  assert.ok(html.includes('in 1 h'));
  assert.ok(!html.includes(String(NOW + 3600)));
});

test('plain view shows validity pills on exp and future nbf', () => {
  const valid = renderPlain({ exp: NOW + 3600 }, NOW);
  assert.ok(valid.includes('pill ok'));
  assert.ok(valid.includes('valid'));
  const expired = renderPlain({ exp: NOW - 3600 }, NOW);
  assert.ok(expired.includes('pill err'));
  assert.ok(expired.includes('expired'));
  const notYet = renderPlain({ nbf: NOW + 3600 }, NOW);
  assert.ok(notYet.includes('pill warn'));
  assert.ok(notYet.includes('not yet active'));
  const activeNbf = renderPlain({ nbf: NOW - 3600 }, NOW);
  assert.ok(!activeNbf.includes('pill'));
});

test('plain view renders booleans as yes/no and null as a dash', () => {
  const html = renderPlain({ beta: true, legacy: false, note: null }, NOW);
  assert.ok(html.includes('yes'));
  assert.ok(html.includes('no'));
  assert.ok(html.includes('—'));
});

test('plain view joins arrays of primitives with commas', () => {
  const html = renderPlain({ aud: ['api', 'web'], roles: ['admin', 'editor'] }, NOW);
  assert.ok(html.includes('api, web'));
  assert.ok(html.includes('admin, editor'));
});

test('plain view renders nested objects as collapsible groups without friendly mapping', () => {
  const html = renderPlain({ ctx: { sub: 'nested', org: { id: 7 } } }, NOW);
  assert.ok(html.includes('<details class="pnode" open>'));
  assert.ok(html.includes('<summary>'));
  assert.ok(html.includes('ctx'));
  assert.ok(html.includes('pkids'));
  assert.ok(html.includes('>sub<'));
  assert.ok(!html.includes('Subject'));
  assert.ok(html.includes('7'));
});

test('plain view escapes HTML in keys and values', () => {
  const html = renderPlain({ '<img src=x>': '<script>alert(1)</script>' }, NOW);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('plain view handles empty objects and primitive roots', () => {
  assert.ok(renderPlain({}, NOW).includes('(empty)'));
  assert.ok(renderPlain('raw', NOW).includes('raw'));
});

test('relative time respects direction, units, and pluralization', () => {
  assert.equal(fmtRel(NOW + 30, NOW), 'in 30 s');
  assert.equal(fmtRel(NOW - 120, NOW), '2 min ago');
  assert.equal(fmtRel(NOW + 86400, NOW), 'in 1 day');
  assert.equal(fmtRel(NOW + 3 * 86400, NOW), 'in 3 days');
  assert.equal(fmtRel(NOW - 31536000, NOW), '1 year ago');
  assert.equal(fmtRel(NOW - 2 * 31536000, NOW), '2 years ago');
});
