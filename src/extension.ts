import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
  base64UrlDecode,
  escapeHtml,
  fmtDate,
  fmtRel,
  jsonToHtml,
  parseToken,
  renderClaims
} from './webviewLogic';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jwtPreview.open', () => {
      openPanel();
    }),
    vscode.commands.registerCommand('jwtPreview.decodeSelection', () => {
      const editor = vscode.window.activeTextEditor;
      const selectedText = editor?.document.getText(editor.selection).trim();
      openPanel(selectedText);
    })
  );
}

function openPanel(initialToken?: string) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    if (initialToken) {
      panel.webview.postMessage({ type: 'setToken', token: initialToken });
    }
  } else {
    panel = vscode.window.createWebviewPanel(
      'jwtPreview',
      'JWT Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    panel.webview.html = getHtml(initialToken);
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

const styles = `
    :root { color-scheme: light dark; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      margin: 0;
    }
    h2 { margin: 0 0 4px 0; }
    :focus-visible {
      outline: 2px solid var(--vscode-focusBorder, #007fd4);
      outline-offset: 1px;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 110px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      padding: 8px;
      resize: vertical;
    }
    .toolbar { margin: 8px 0 16px 0; display: flex; gap: 8px; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 5px 12px;
      border-radius: 3px;
      cursor: pointer;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button:hover { opacity: 0.9; }
    .section { margin-bottom: 18px; }
    .section h3 {
      margin: 0 0 6px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
    }
    pre, .jsonbox {
      padding: 12px;
      border-radius: 4px;
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1));
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .jsonbox { line-height: 1.5; }
    .header .jsonbox { border-left: 3px solid #fb015b; }
    .payload .jsonbox { border-left: 3px solid #d63aff; }
    .sig pre { border-left: 3px solid #00b9f1; }
    .jsonbox summary {
      cursor: pointer;
      list-style: none;
    }
    .jsonbox summary::-webkit-details-marker { display: none; }
    .jnode > summary::before {
      content: '▸';
      display: inline-block;
      width: 13px;
      opacity: 0.6;
    }
    .jnode[open] > summary::before { content: '▾'; }
    .jnode:not([open]) > summary::after {
      content: ' … ' attr(data-close);
      opacity: 0.7;
    }
    .jkids { padding-left: 18px; }
    .jrow { padding-left: 13px; }
    .jkey { color: var(--vscode-debugTokenExpression-name, #9cdcfe); }
    .jstr { color: var(--vscode-debugTokenExpression-string, #ce9178); }
    .jnum { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
    .jlit { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
    button.mini {
      font-size: 10px;
      padding: 1px 6px;
      margin-left: 6px;
      text-transform: none;
      letter-spacing: normal;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .claims { margin-top: 10px; }
    .claims-box {
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.25));
      border-radius: 6px;
      overflow: hidden;
    }
    .claim-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding: 7px 12px;
      font-size: 12px;
    }
    .claim-row + .claim-row {
      border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.15));
    }
    .claim-key {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      padding: 1px 7px;
      border-radius: 4px;
      background: rgba(127,127,127,0.15);
    }
    .claim-name { opacity: 0.75; min-width: 64px; }
    .claim-val { margin-left: auto; text-align: right; }
    .claim-sub { opacity: 0.6; font-size: 11px; }
    .pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 10px;
      margin-left: 8px;
    }
    .pill.ok {
      background: rgba(63,185,80,0.14);
      color: var(--vscode-testing-iconPassed, #3fb950);
    }
    .pill.err {
      background: rgba(248,81,73,0.14);
      color: var(--vscode-errorForeground, #f85149);
    }
    .pill.warn {
      background: rgba(210,153,34,0.14);
      color: var(--vscode-editorWarning-foreground, #d29922);
    }
    .error-box {
      padding: 10px 12px;
      border-radius: 4px;
      background: rgba(248,81,73,0.12);
      color: var(--vscode-errorForeground, #f85149);
    }
    .hidden { display: none; }
`;

function getSharedFunctionSources(): string {
  return [
    escapeHtml,
    base64UrlDecode,
    parseToken,
    jsonToHtml,
    fmtDate,
    fmtRel,
    renderClaims
  ].map(fn => fn.toString()).join('\n\n');
}

function getScript(): string {
  return `
    ${getSharedFunctionSources()}

    const input = document.getElementById('input');
    const errorBox = document.getElementById('error');
    const result = document.getElementById('result');
    const headerEl = document.getElementById('header');
    const payloadEl = document.getElementById('payload');
    const signatureEl = document.getElementById('signature');
    const claimsEl = document.getElementById('claims');

    function renderJsonInto(el, jsonStr) {
      try {
        el.innerHTML = jsonToHtml(JSON.parse(jsonStr), '');
      } catch (e) {
        el.textContent = jsonStr;
      }
    }

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
      result.classList.add('hidden');
    }

    function decode() {
      const parsed = parseToken(input.value);
      if (parsed.kind === 'empty') {
        errorBox.classList.add('hidden');
        result.classList.add('hidden');
        return;
      }
      if (parsed.kind === 'invalid') {
        showError("This doesn't look like a JWT — expected 2–3 parts separated by a dot.");
        return;
      }
      if (parsed.kind === 'error') {
        showError('Failed to decode the token: ' + parsed.message);
        return;
      }
      renderJsonInto(headerEl, parsed.headerStr);
      renderJsonInto(payloadEl, parsed.payloadStr);
      signatureEl.textContent = parsed.signature || '(no signature)';

      const now = Math.floor(Date.now() / 1000);
      let claimsHtml = '';
      try { claimsHtml = renderClaims(JSON.parse(parsed.payloadStr), now); } catch (e) {}
      claimsEl.innerHTML = claimsHtml;

      errorBox.classList.add('hidden');
      result.classList.remove('hidden');
    }

    const jsonBoxes = { header: headerEl, payload: payloadEl };
    document.querySelectorAll('button.mini').forEach(btn => {
      btn.addEventListener('click', () => {
        const box = jsonBoxes[btn.dataset.target];
        box.querySelectorAll('details').forEach(d => { d.open = btn.dataset.open === 'true'; });
      });
    });

    input.addEventListener('input', decode);
    document.getElementById('clear').addEventListener('click', () => {
      input.value = '';
      decode();
      input.focus();
    });
    document.getElementById('paste').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        input.value = text.trim();
        decode();
      } catch (e) {
        showError('No clipboard access — paste the token manually (Ctrl/Cmd+V).');
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'setToken') {
        input.value = msg.token;
        decode();
      }
    });

    decode();
    input.focus();
`;
}

export function getHtml(initialToken?: string): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `connect-src 'none'`,
    `img-src 'none'`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JWT Preview</title>
  <style nonce="${nonce}">${styles}  </style>
</head>
<body>
  <h2>JWT Preview</h2>

  <textarea id="input" placeholder="Paste a JWT token" aria-label="Paste a JWT token" spellcheck="false">${initialToken ? escapeHtml(initialToken) : ''}</textarea>
  <div class="toolbar">
    <button id="paste" class="secondary">Paste &amp; decode</button>
    <button id="clear" class="secondary">Clear</button>
  </div>

  <div id="error" class="error-box hidden" role="alert"></div>

  <div id="result" class="hidden">
    <div class="section header">
      <h3>Header
        <button class="mini" data-target="header" data-open="true">Expand all</button>
        <button class="mini" data-target="header" data-open="false">Collapse all</button>
      </h3>
      <div class="jsonbox" id="header"></div>
    </div>
    <div class="section payload">
      <h3>Payload
        <button class="mini" data-target="payload" data-open="true">Expand all</button>
        <button class="mini" data-target="payload" data-open="false">Collapse all</button>
      </h3>
      <div class="jsonbox" id="payload"></div>
      <div class="claims" id="claims"></div>
    </div>
    <div class="section sig">
      <h3>Signature</h3>
      <pre id="signature"></pre>
    </div>
  </div>

  <script nonce="${nonce}">${getScript()}  </script>
</body>
</html>`;
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}
