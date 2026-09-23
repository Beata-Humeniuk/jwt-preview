import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml, formatSize, hexDump, jsonToHtml } from '../src/render';

test('escapeHtml escapes all special characters', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
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

test('JSON tree renders nested and empty containers', () => {
  const html = jsonToHtml({ a: [1, 'x', null, true], b: {}, c: [] }, '');
  assert.ok(html.includes('<details class="jnode" open>'));
  assert.ok(html.includes('data-close="]"'));
  assert.ok(html.includes('class="jnum">1<'));
  assert.ok(html.includes('class="jstr">"x"<'));
  assert.ok(html.includes('class="jlit">null<'));
  assert.ok(html.includes('{}'));
  assert.ok(html.includes('[]'));
});

test('large JSON renders without hanging', () => {
  const large: Record<string, string> = {};
  for (let i = 0; i < 2000; i++) {
    large['key' + i] = 'value-' + i;
  }
  const html = jsonToHtml(large, '');
  assert.ok(html.includes('key1999'));
  assert.ok(html.includes('value-1999'));
});

test('formatSize picks a readable unit', () => {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(1023), '1023 B');
  assert.equal(formatSize(1024), '1 KB');
  assert.equal(formatSize(1536), '1.5 KB');
  assert.equal(formatSize(12 * 1024), '12 KB');
  assert.equal(formatSize(3 * 1024 * 1024 + 200 * 1024), '3.2 MB');
  assert.equal(formatSize(5 * 1024 * 1024 * 1024), '5 GB');
});

test('hexDump lays out 16 bytes per line with offsets and an ASCII column', () => {
  const data = Uint8Array.from([...Buffer.from('Hello, world!'), 0x00, 0xff, 0x7f, 0x41, 0x42]);
  const lines = hexDump(data, 4096).split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '00000000  48 65 6c 6c 6f 2c 20 77  6f 72 6c 64 21 00 ff 7f  |Hello, world!...|');
  assert.equal(lines[1], '00000010  41 42                                             |AB|');
});

test('hexDump stops at the byte limit and handles empty input', () => {
  const data = new Uint8Array(100).fill(0x41);
  const lines = hexDump(data, 32).split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('00000010'));
  assert.equal(hexDump(new Uint8Array(0), 16), '');
});
