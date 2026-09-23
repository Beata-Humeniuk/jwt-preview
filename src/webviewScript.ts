import { decodeBase64, normalizeBase64 } from './base64';
import { classifyText, decodeText, detectContent, detectSignature, formatForMime } from './detect';
import { escapeHtml, formatSize, hexDump, jsonToHtml } from './render';

/**
 * Functions shared between the extension host and the webview. Their compiled
 * source is embedded verbatim into the webview script, so every one of them has
 * to be self-contained: no imports, no module-level constants, only calls to other
 * exported function declarations from the same module.
 */
const SHARED_WEBVIEW_FUNCTIONS: Array<(...args: never[]) => unknown> = [
  escapeHtml,
  jsonToHtml,
  formatSize,
  hexDump,
  normalizeBase64,
  decodeBase64,
  formatForMime,
  detectSignature,
  decodeText,
  classifyText,
  detectContent
];

export function sharedWebviewSource(): string {
  return SHARED_WEBVIEW_FUNCTIONS.map(fn => fn.toString()).join('\n\n');
}
