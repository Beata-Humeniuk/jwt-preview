import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeBase64, looksLikeBase64, normalizeBase64 } from '../src/base64';

function b64(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function decodeToString(raw: string): string {
  const normalized = normalizeBase64(raw);
  assert.equal(normalized.kind, 'ok');
  if (normalized.kind !== 'ok') { throw new Error('unreachable'); }
  return Buffer.from(decodeBase64(normalized.base64)).toString('utf-8');
}

test('standard Base64 round-trips through normalize and decode', () => {
  for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde', 'Żółć 日本語 🙂']) {
    assert.equal(decodeToString(b64(value)), value);
  }
});

test('missing padding is restored', () => {
  assert.equal(decodeToString('aGVsbG8'), 'hello');
  assert.equal(decodeToString('aGk'), 'hi');
});

test('URL-safe alphabet is accepted and reported', () => {
  const value = Buffer.from([0xfb, 0xff, 0xbf, 0xfe]);
  const urlSafe = value.toString('base64url');
  assert.ok(urlSafe.includes('-') || urlSafe.includes('_'));
  const normalized = normalizeBase64(urlSafe);
  assert.equal(normalized.kind, 'ok');
  if (normalized.kind === 'ok') {
    assert.equal(normalized.urlSafe, true);
    assert.deepEqual(Buffer.from(decodeBase64(normalized.base64)), value);
  }
});

test('whitespace, line wrapping and surrounding quotes are ignored', () => {
  const wrapped = b64('x'.repeat(200)).replace(/(.{76})/g, '$1\r\n');
  assert.equal(decodeToString(wrapped), 'x'.repeat(200));
  assert.equal(decodeToString('  "' + b64('quoted') + '"\n'), 'quoted');
  assert.equal(decodeToString("'" + b64('single') + "'"), 'single');
});

test('data: URIs are unwrapped and their media type is kept as a hint', () => {
  const normalized = normalizeBase64('data:Image/PNG;base64,' + b64('png?'));
  assert.equal(normalized.kind, 'ok');
  if (normalized.kind === 'ok') {
    assert.equal(normalized.fromDataUri, true);
    assert.equal(normalized.mimeHint, 'image/png');
    assert.equal(Buffer.from(decodeBase64(normalized.base64)).toString(), 'png?');
  }
  const withCharset = normalizeBase64('data:text/plain;charset=utf-8;base64,' + b64('hi'));
  assert.equal(withCharset.kind, 'ok');
  if (withCharset.kind === 'ok') {
    assert.equal(withCharset.mimeHint, 'text/plain');
  }
  const noType = normalizeBase64('data:;base64,' + b64('hi'));
  assert.equal(noType.kind, 'ok');
  if (noType.kind === 'ok') {
    assert.equal(noType.mimeHint, undefined);
  }
});

test('data: URIs without ;base64 or without content are rejected with a message', () => {
  const plain = normalizeBase64('data:text/plain,hello');
  assert.equal(plain.kind, 'invalid');
  const empty = normalizeBase64('data:text/plain;base64,');
  assert.equal(empty.kind, 'invalid');
  if (empty.kind === 'invalid') {
    assert.match(empty.message, /no content/);
  }
});

test('empty and whitespace-only input is reported as empty', () => {
  assert.equal(normalizeBase64('').kind, 'empty');
  assert.equal(normalizeBase64('  \n\t ').kind, 'empty');
  assert.equal(normalizeBase64('""').kind, 'empty');
});

test('invalid characters, mid-text padding, mixed alphabets and bad lengths are reported', () => {
  const bad = normalizeBase64('aGVs*bG8=');
  assert.equal(bad.kind, 'invalid');
  if (bad.kind === 'invalid') { assert.match(bad.message, /"\*"/); }

  const padding = normalizeBase64('aGVs=bG8=');
  assert.equal(padding.kind, 'invalid');
  if (padding.kind === 'invalid') { assert.match(padding.message, /Padding/); }

  const mixed = normalizeBase64('ab+c_d==');
  assert.equal(mixed.kind, 'invalid');
  if (mixed.kind === 'invalid') { assert.match(mixed.message, /alphabets/); }

  const length = normalizeBase64('aGVsbG8xx');
  assert.equal(length.kind, 'invalid');
  if (length.kind === 'invalid') { assert.match(length.message, /length/); }
});

test('looksLikeBase64 accepts encoded files, wrapped Base64 and data: URIs', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3, 4]);
  assert.equal(looksLikeBase64(png.toString('base64')), true);
  assert.equal(looksLikeBase64(png.toString('base64').replace(/(.{8})/g, '$1\n')), true);
  assert.equal(looksLikeBase64(' data:image/png;base64,' + png.toString('base64') + ' '), true);
  assert.equal(looksLikeBase64(b64('{"user":"demo","roles":["admin"]}')), true);
});

test('looksLikeBase64 rejects prose, short words, JWTs and single-class identifiers', () => {
  assert.equal(looksLikeBase64(''), false);
  assert.equal(looksLikeBase64('hello world this is text'), false);
  assert.equal(looksLikeBase64('test'), false);
  assert.equal(looksLikeBase64('abcdefghijklmnopqrstuvwx'), false);
  assert.equal(looksLikeBase64('ABCDEFGHIJKLMNOPQRSTUVWX'), false);
  assert.equal(looksLikeBase64('12345678901234567890'), false);
  assert.equal(looksLikeBase64('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc'), false);
  assert.equal(looksLikeBase64('www.example.com'), false);
  assert.equal(looksLikeBase64('Bearer ' + b64('token-token-token')), false);
});
