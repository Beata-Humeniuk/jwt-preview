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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_test_1 = require("node:test");
const l10n_1 = require("../src/l10n");
const root = path.join(__dirname, '..', '..');
function readNls(file) {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf-8'));
}
(0, node_test_1.test)('every supported language has a manifest translation file', () => {
    for (const lang of l10n_1.SUPPORTED_LANGS) {
        if (lang === 'en') {
            continue;
        }
        const file = `package.nls.${lang}.json`;
        assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
    }
});
(0, node_test_1.test)('no unexpected manifest translation files exist', () => {
    const known = new Set(l10n_1.SUPPORTED_LANGS.map(l => `package.nls.${l}.json`));
    const found = fs.readdirSync(root).filter(f => /^package\.nls\..+\.json$/.test(f));
    for (const file of found) {
        assert.ok(known.has(file), `unknown locale file ${file}`);
    }
});
(0, node_test_1.test)('every locale file has exactly the keys of the English source', () => {
    const reference = Object.keys(readNls('package.nls.json')).sort();
    assert.ok(reference.length > 0);
    for (const lang of l10n_1.SUPPORTED_LANGS) {
        if (lang === 'en') {
            continue;
        }
        const keys = Object.keys(readNls(`package.nls.${lang}.json`)).sort();
        assert.deepEqual(keys, reference, `key mismatch in package.nls.${lang}.json`);
    }
});
(0, node_test_1.test)('no locale has an empty translation value', () => {
    const files = ['package.nls.json', ...l10n_1.SUPPORTED_LANGS.filter(l => l !== 'en').map(l => `package.nls.${l}.json`)];
    for (const file of files) {
        for (const [key, value] of Object.entries(readNls(file))) {
            assert.ok(typeof value === 'string' && value.trim().length > 0, `empty value for ${key} in ${file}`);
        }
    }
});
(0, node_test_1.test)('language codes in the manifest enum match supported languages', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    const enumValues = manifest.contributes.configuration.properties['jwtDecoder.language'].enum;
    assert.deepEqual(enumValues, ['auto', ...l10n_1.SUPPORTED_LANGS]);
    assert.equal(manifest.contributes.configuration.properties['jwtDecoder.language'].enumDescriptions.length, enumValues.length);
});
//# sourceMappingURL=nlsParity.test.js.map