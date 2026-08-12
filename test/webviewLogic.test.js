"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const node_test_1 = require("node:test");
const l10n_1 = require("../src/l10n");
const webviewLogic_1 = require("../src/webviewLogic");
function b64url(value) {
    return Buffer.from(value, 'utf-8').toString('base64url');
}
function makeToken(header, payload, signature) {
    const parts = [b64url(JSON.stringify(header)), b64url(JSON.stringify(payload))];
    if (signature !== undefined) {
        parts.push(signature);
    }
    return parts.join('.');
}
const NOW = 1700000000;
(0, node_test_1.test)('valid three-part token decodes header, payload, and signature', () => {
    const token = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'test-user' }, 'c2lnbmF0dXJl');
    const parsed = (0, webviewLogic_1.parseToken)(token);
    assert.equal(parsed.kind, 'ok');
    if (parsed.kind === 'ok') {
        assert.deepEqual(JSON.parse(parsed.headerStr), { alg: 'HS256', typ: 'JWT' });
        assert.deepEqual(JSON.parse(parsed.payloadStr), { sub: 'test-user' });
        assert.equal(parsed.signature, 'c2lnbmF0dXJl');
    }
});
(0, node_test_1.test)('valid two-part token has empty signature', () => {
    const parsed = (0, webviewLogic_1.parseToken)(makeToken({ alg: 'none' }, { sub: 'x' }));
    assert.equal(parsed.kind, 'ok');
    if (parsed.kind === 'ok') {
        assert.equal(parsed.signature, '');
    }
});
(0, node_test_1.test)('base64url padding variants decode correctly', () => {
    for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
        assert.equal((0, webviewLogic_1.base64UrlDecode)(b64url(value)), value);
    }
});
(0, node_test_1.test)('base64url uses URL-safe alphabet', () => {
    const value = 'ÿþ??>>';
    const encoded = b64url(value);
    assert.equal((0, webviewLogic_1.base64UrlDecode)(encoded), value);
});
(0, node_test_1.test)('UTF-8 and non-Latin characters decode correctly', () => {
    const payload = { name: 'Żółć 日本語 한국어 中文 🙂' };
    const parsed = (0, webviewLogic_1.parseToken)(makeToken({ alg: 'none' }, payload));
    assert.equal(parsed.kind, 'ok');
    if (parsed.kind === 'ok') {
        assert.deepEqual(JSON.parse(parsed.payloadStr), payload);
    }
});
(0, node_test_1.test)('malformed base64url reports a graceful error', () => {
    const parsed = (0, webviewLogic_1.parseToken)('!!!.@@@');
    assert.equal(parsed.kind, 'error');
    if (parsed.kind === 'error') {
        assert.equal(typeof parsed.message, 'string');
    }
});
(0, node_test_1.test)('invalid JSON in payload still decodes to a string without throwing', () => {
    const parsed = (0, webviewLogic_1.parseToken)(b64url('{"alg":"none"}') + '.' + b64url('not json at all'));
    assert.equal(parsed.kind, 'ok');
    if (parsed.kind === 'ok') {
        assert.equal(parsed.payloadStr, 'not json at all');
        assert.throws(() => JSON.parse(parsed.payloadStr));
    }
});
(0, node_test_1.test)('empty and whitespace-only input is reported as empty', () => {
    assert.equal((0, webviewLogic_1.parseToken)('').kind, 'empty');
    assert.equal((0, webviewLogic_1.parseToken)('   \n\t ').kind, 'empty');
});
(0, node_test_1.test)('too few or too many dot-separated parts is invalid', () => {
    assert.equal((0, webviewLogic_1.parseToken)('justonepart').kind, 'invalid');
    assert.equal((0, webviewLogic_1.parseToken)('a.b.c.d').kind, 'invalid');
});
(0, node_test_1.test)('large payload renders without hanging', () => {
    const large = {};
    for (let i = 0; i < 2000; i++) {
        large['key' + i] = 'value-' + i;
    }
    const html = (0, webviewLogic_1.jsonToHtml)(large, '');
    assert.ok(html.includes('key1999'));
    assert.ok(html.includes('value-1999'));
});
(0, node_test_1.test)('exp in the past renders expired pill, in the future renders valid pill', () => {
    const expired = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { exp: NOW - 60 }, NOW);
    assert.ok(expired.includes('err'));
    assert.ok(expired.includes(l10n_1.STRINGS.en.expired));
    const valid = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { exp: NOW + 3600 }, NOW);
    assert.ok(valid.includes('ok'));
    assert.ok(valid.includes(l10n_1.STRINGS.en.valid));
});
(0, node_test_1.test)('iat and nbf render, future nbf gets a warning pill', () => {
    const html = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { iat: NOW - 100, nbf: NOW + 100 }, NOW);
    assert.ok(html.includes('iat'));
    assert.ok(html.includes('nbf'));
    assert.ok(html.includes(l10n_1.STRINGS.en.notYetActive));
    const active = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { nbf: NOW - 100 }, NOW);
    assert.ok(!active.includes(l10n_1.STRINGS.en.notYetActive));
});
(0, node_test_1.test)('absent optional claims produce no claim rows', () => {
    assert.equal((0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { custom: 'x' }, NOW), '');
});
(0, node_test_1.test)('aud renders both string and array forms', () => {
    const single = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { aud: 'api' }, NOW);
    assert.ok(single.includes('api'));
    const multi = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, { aud: ['api', 'web'] }, NOW);
    assert.ok(multi.includes('api, web'));
});
(0, node_test_1.test)('HTML injection in JSON keys and values is escaped', () => {
    const evil = {
        '<img src=x onerror=alert(1)>': '<script>alert(2)</script>',
        nested: { '"><svg onload=alert(3)>': "'-alert(4)-'" }
    };
    const html = (0, webviewLogic_1.jsonToHtml)(evil, '');
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<svg'));
    assert.ok(html.includes('&lt;script&gt;'));
});
(0, node_test_1.test)('HTML injection in claim values is escaped', () => {
    const html = (0, webviewLogic_1.renderClaims)('en', l10n_1.STRINGS.en, {
        iss: '<script>alert(1)</script>',
        sub: '"><b>x</b>',
        aud: ['<i>a</i>', 'b']
    }, NOW);
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<b>'));
    assert.ok(!html.includes('<i>'));
});
(0, node_test_1.test)('escapeHtml escapes all special characters', () => {
    assert.equal((0, webviewLogic_1.escapeHtml)(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});
(0, node_test_1.test)('fmtDate formats epoch seconds as UTC', () => {
    assert.equal((0, webviewLogic_1.fmtDate)(0), '1970-01-01 00:00:00 UTC');
});
(0, node_test_1.test)('plural forms follow language-specific rules', () => {
    assert.equal((0, webviewLogic_1.pluralForm)('en', l10n_1.STRINGS.en.day, 1), 'day');
    assert.equal((0, webviewLogic_1.pluralForm)('en', l10n_1.STRINGS.en.day, 2), 'days');
    assert.equal((0, webviewLogic_1.pluralForm)('pl', l10n_1.STRINGS.pl.day, 1), 'dzień');
    assert.equal((0, webviewLogic_1.pluralForm)('pl', l10n_1.STRINGS.pl.year, 2), 'lata');
    assert.equal((0, webviewLogic_1.pluralForm)('pl', l10n_1.STRINGS.pl.year, 5), 'lat');
    assert.equal((0, webviewLogic_1.pluralForm)('pl', l10n_1.STRINGS.pl.year, 12), 'lat');
    assert.equal((0, webviewLogic_1.pluralForm)('pl', l10n_1.STRINGS.pl.year, 22), 'lata');
    assert.equal((0, webviewLogic_1.pluralForm)('ru', l10n_1.STRINGS.ru.year, 2), 'года');
    assert.equal((0, webviewLogic_1.pluralForm)('ru', l10n_1.STRINGS.ru.year, 5), 'лет');
    assert.equal((0, webviewLogic_1.pluralForm)('ru', l10n_1.STRINGS.ru.year, 21), 'год');
    assert.equal((0, webviewLogic_1.pluralForm)('cs', l10n_1.STRINGS.cs.day, 2), 'dny');
    assert.equal((0, webviewLogic_1.pluralForm)('cs', l10n_1.STRINGS.cs.day, 5), 'dní');
    assert.equal((0, webviewLogic_1.pluralForm)('cs', l10n_1.STRINGS.cs.day, 22), 'dní');
    assert.equal((0, webviewLogic_1.pluralForm)('zh-cn', l10n_1.STRINGS['zh-cn'].day, 5), '天');
});
(0, node_test_1.test)('relative time respects direction, units, and separators', () => {
    assert.equal((0, webviewLogic_1.fmtRel)('en', l10n_1.STRINGS.en, NOW + 30, NOW), 'in 30 s');
    assert.equal((0, webviewLogic_1.fmtRel)('en', l10n_1.STRINGS.en, NOW - 120, NOW), '2 min ago');
    assert.equal((0, webviewLogic_1.fmtRel)('en', l10n_1.STRINGS.en, NOW + 3 * 86400, NOW), 'in 3 days');
    assert.equal((0, webviewLogic_1.fmtRel)('pl', l10n_1.STRINGS.pl, NOW - 3 * 86400, NOW), '3 dni temu');
    assert.equal((0, webviewLogic_1.fmtRel)('zh-cn', l10n_1.STRINGS['zh-cn'], NOW + 3 * 86400, NOW), '3天后');
});
//# sourceMappingURL=webviewLogic.test.js.map