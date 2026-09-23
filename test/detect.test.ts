import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyText, decodeText, detectContent, detectSignature, formatForMime } from '../src/detect';

function bytes(...values: Array<number | string>): Uint8Array {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === 'string') {
      for (const c of v) { out.push(c.charCodeAt(0)); }
    } else {
      out.push(v);
    }
  }
  return Uint8Array.from(out);
}

function utf8(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf-8'));
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82];

test('image signatures are recognised', () => {
  assert.equal(detectContent(bytes(...PNG_HEADER)).mime, 'image/png');
  assert.equal(detectContent(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, 'JFIF')).mime, 'image/jpeg');
  assert.equal(detectContent(bytes('GIF89a', 1, 0, 1, 0)).mime, 'image/gif');
  assert.equal(detectContent(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')).mime, 'image/webp');
  assert.equal(detectContent(bytes(0, 0, 1, 0, 1, 0, 16, 16)).mime, 'image/x-icon');
  assert.equal(detectContent(bytes(0, 0, 0, 24, 'ftypavif')).mime, 'image/avif');
  const png = detectContent(bytes(...PNG_HEADER));
  assert.equal(png.kind, 'image');
  assert.equal(png.format, 'PNG image');
  assert.equal(png.extension, 'png');
});

test('document, archive and media signatures are recognised as binary', () => {
  assert.equal(detectContent(bytes('%PDF-1.7\n', 0, 1, 2)).mime, 'application/pdf');
  assert.equal(detectContent(bytes(0x1f, 0x8b, 8, 0, 0, 0)).mime, 'application/gzip');
  assert.equal(detectContent(bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0)).mime, 'application/x-7z-compressed');
  assert.equal(detectContent(bytes('Rar!', 0x1a, 0x07, 0x01, 0)).mime, 'application/vnd.rar');
  assert.equal(detectContent(bytes('ID3', 4, 0, 0, 0)).mime, 'audio/mpeg');
  assert.equal(detectContent(bytes('OggS', 0, 2, 0)).mime, 'audio/ogg');
  assert.equal(detectContent(bytes(0, 0, 0, 32, 'ftypisom', 0)).mime, 'video/mp4');
  assert.equal(detectContent(bytes(0x1a, 0x45, 0xdf, 0xa3, 1)).mime, 'video/webm');
  assert.equal(detectContent(bytes('wOF2', 0, 1)).mime, 'font/woff2');
  assert.equal(detectContent(bytes(0x7f, 'ELF', 2, 1)).mime, 'application/x-elf');
  assert.equal(detectContent(bytes(0, 'asm', 1, 0, 0, 0)).mime, 'application/wasm');
  assert.equal(detectContent(bytes('SQLite format 3', 0, 16)).mime, 'application/vnd.sqlite3');
  const pdf = detectContent(bytes('%PDF-1.7\n', 0, 1, 2));
  assert.equal(pdf.kind, 'binary');
  assert.equal(pdf.extension, 'pdf');
  assert.equal(pdf.text, undefined);
});

test('tar is recognised by the ustar marker at offset 257', () => {
  const tar = new Uint8Array(512);
  tar.set(bytes('ustar'), 257);
  assert.equal(detectContent(tar).mime, 'application/x-tar');
});

test('ZIP archives are told apart from Office documents and JARs', () => {
  const zip = (entry: string) => bytes('PK', 3, 4, 20, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, entry.length, 0, 0, 0, entry, 0, 1, 2);
  assert.equal(detectContent(zip('README.txt')).extension, 'zip');
  assert.equal(detectContent(zip('word/document.xml')).extension, 'docx');
  assert.equal(detectContent(zip('xl/workbook.xml')).extension, 'xlsx');
  assert.equal(detectContent(zip('ppt/presentation.xml')).extension, 'pptx');
  assert.equal(detectContent(zip('META-INF/MANIFEST.MF')).extension, 'jar');
});

test('weak signatures only apply to bytes that are not text', () => {
  assert.equal(detectContent(utf8('BMW is a car maker')).kind, 'text');
  assert.equal(detectContent(utf8('MZ')).kind, 'text');
  assert.equal(detectContent(bytes('BM', 0x36, 0x30, 0, 0, 0, 0, 0, 0)).mime, 'image/bmp');
  assert.equal(detectContent(bytes('MZ', 0x90, 0, 3, 0, 0, 0)).mime, 'application/vnd.microsoft.portable-executable');
  assert.equal(detectSignature(bytes('BM', 0, 0), false), undefined);
});

test('UTF-8 text decodes and is classified by content', () => {
  const plain = detectContent(utf8('Hello, Żółć 日本語 🙂\nline two\ttabbed\r\n'));
  assert.equal(plain.kind, 'text');
  assert.equal(plain.mime, 'text/plain');
  assert.equal(plain.extension, 'txt');
  assert.equal(plain.language, 'plaintext');
  assert.equal(plain.encoding, 'utf-8');
  assert.equal(plain.text, 'Hello, Żółć 日本語 🙂\nline two\ttabbed\r\n');
  assert.equal(plain.isJson, false);
});

test('JSON, XML, SVG, HTML, PEM, RTF and JWT text are named', () => {
  const json = detectContent(utf8(' {"a":[1,2,{"b":null}]} '));
  assert.equal(json.mime, 'application/json');
  assert.equal(json.isJson, true);
  assert.equal(json.language, 'json');
  assert.equal(detectContent(utf8('{not json')).mime, 'text/plain');
  assert.equal(detectContent(utf8('[1, 2')).mime, 'text/plain');

  const svg = detectContent(utf8('<?xml version="1.0"?>\n<!-- c -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  assert.equal(svg.mime, 'image/svg+xml');
  assert.equal(svg.kind, 'image');
  assert.equal(typeof svg.text, 'string');
  assert.equal(detectContent(utf8('<svg></svg>')).extension, 'svg');

  assert.equal(detectContent(utf8('<!DOCTYPE html><html></html>')).mime, 'text/html');
  assert.equal(detectContent(utf8('<html lang="en"></html>')).extension, 'html');
  assert.equal(detectContent(utf8('<?xml version="1.0"?><root/>')).mime, 'application/xml');
  assert.equal(detectContent(utf8('-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----')).extension, 'pem');
  assert.equal(detectContent(utf8('{\\rtf1\\ansi Hello}')).extension, 'rtf');

  const jwt = detectContent(utf8('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln'));
  assert.equal(jwt.format, 'JSON Web Token');
  assert.equal(jwt.kind, 'text');
});

test('UTF-8 and UTF-16 byte order marks are honoured', () => {
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from('{"x":1}')]);
  const withBom = detectContent(bom);
  assert.equal(withBom.isJson, true);
  assert.equal(withBom.text, '{"x":1}');

  const utf16le = Uint8Array.from([0xff, 0xfe, ...Buffer.from('hi Ż', 'utf16le')]);
  const le = detectContent(utf16le);
  assert.equal(le.kind, 'text');
  assert.equal(le.encoding, 'utf-16le');
  assert.equal(le.text, 'hi Ż');
});

test('bytes that are not text and match no signature are binary data', () => {
  const random = Uint8Array.from([0x00, 0x11, 0xfe, 0x80, 0x81, 0x99, 0x00, 0xc3]);
  const info = detectContent(random);
  assert.equal(info.kind, 'binary');
  assert.equal(info.format, 'Binary data');
  assert.equal(info.mime, 'application/octet-stream');
  assert.equal(info.extension, 'bin');
  assert.equal(decodeText(random), undefined);
  assert.equal(decodeText(Uint8Array.from([0x41, 0x00, 0x42])), undefined);
  assert.equal(decodeText(Uint8Array.from([0xc3, 0x28])), undefined);
});

test('a declared media type refines generic results but never overrides a signature', () => {
  const csv = detectContent(utf8('a,b\n1,2\n'), 'text/csv');
  assert.equal(csv.extension, 'csv');
  assert.equal(csv.format, 'CSV');
  assert.equal(csv.declaredMime, 'text/csv');

  const markdown = detectContent(utf8('# Title'), 'text/markdown');
  assert.equal(markdown.language, 'markdown');

  const jsonWins = detectContent(utf8('{"a":1}'), 'text/csv');
  assert.equal(jsonWins.mime, 'application/json');
  assert.equal(jsonWins.declaredMime, 'text/csv');

  const png = detectContent(bytes(...PNG_HEADER), 'image/jpeg');
  assert.equal(png.mime, 'image/png');
  assert.equal(png.declaredMime, 'image/jpeg');

  const random = Uint8Array.from([0x00, 0x11, 0xfe, 0x80, 0x81, 0x99]);
  assert.equal(detectContent(random, 'audio/mpeg').extension, 'mp3');
  assert.equal(detectContent(random, 'image/png').extension, 'bin');
  assert.equal(detectContent(random, 'application/x-unknown').extension, 'bin');
  assert.equal(detectContent(random, 'application/x-unknown').declaredMime, 'application/x-unknown');
  assert.equal(detectContent(random).declaredMime, undefined);
});

test('media type aliases resolve to canonical entries', () => {
  assert.equal(formatForMime('image/jpg')?.mime, 'image/jpeg');
  assert.equal(formatForMime('text/xml')?.mime, 'application/xml');
  assert.equal(formatForMime('application/javascript')?.extension, 'js');
  assert.equal(formatForMime('application/x-unknown'), undefined);
  assert.equal(classifyText('plain words', 'application/x-unknown').mime, 'text/plain');
});
