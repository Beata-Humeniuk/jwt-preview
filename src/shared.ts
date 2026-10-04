import { claimValidityPill, escapeHtml, fmtDate, fmtRel, jsonToHtml, renderClaims, renderPlain } from './render';
import { base64UrlDecode, parseToken, splitSegments } from './token';

/**
 * Functions that run both in the extension host and inside the webview.
 *
 * They are shipped to the webview as source text (`Function.prototype.toString`),
 * so each one must be self-contained: it may call other functions on this list,
 * but it must not reference imports, module-level constants or anything else
 * from its defining module. `test/shared.test.ts` guards this.
 */
export const SHARED_WEBVIEW_FUNCTIONS: ReadonlyArray<(...args: never[]) => unknown> = [
  escapeHtml,
  base64UrlDecode,
  splitSegments,
  parseToken,
  jsonToHtml,
  fmtDate,
  fmtRel,
  claimValidityPill,
  renderClaims,
  renderPlain
];

export function sharedWebviewSource(): string {
  return SHARED_WEBVIEW_FUNCTIONS.map(fn => fn.toString()).join('\n\n');
}
