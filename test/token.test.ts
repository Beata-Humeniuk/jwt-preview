import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64UrlDecode, parseToken } from '../src/token';

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
