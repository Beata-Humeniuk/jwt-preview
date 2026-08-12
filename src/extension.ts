import * as vscode from 'vscode';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jwtDecoder.open', () => {
      openPanel();
    }),
    vscode.commands.registerCommand('jwtDecoder.decodeSelection', () => {
      const editor = vscode.window.activeTextEditor;
      const selectedText = editor?.document.getText(editor.selection).trim();
      openPanel(selectedText);
    })
  );
}

function openPanel(initialToken?: string) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
  } else {
    panel = vscode.window.createWebviewPanel(
      'jwtDecoder',
      'JWT Decoder',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    panel.webview.html = getHtml();
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }

  if (initialToken) {
    panel.webview.postMessage({ type: 'setToken', token: initialToken });
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
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

const script = `
    const input = document.getElementById('input');
    const errorBox = document.getElementById('error');
    const result = document.getElementById('result');
    const headerEl = document.getElementById('header');
    const payloadEl = document.getElementById('payload');
    const signatureEl = document.getElementById('signature');
    const claimsEl = document.getElementById('claims');

    function base64UrlDecode(str) {
      let s = str.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) { s += '='; }
      const binary = atob(s);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
      return new TextDecoder('utf-8').decode(bytes);
    }

    function jsonToHtml(value, keyHtml) {
      if (value === null || typeof value !== 'object') {
        const isString = typeof value === 'string';
        const cls = isString ? 'jstr' : (typeof value === 'number' ? 'jnum' : 'jlit');
        const text = isString ? '"' + escapeHtml(value) + '"' : String(value);
        return '<div class="jrow">' + keyHtml + '<span class="' + cls + '">' + text + '</span></div>';
      }
      const isArr = Array.isArray(value);
      const open = isArr ? '[' : '{';
      const close = isArr ? ']' : '}';
      const entries = isArr ? value.map(v => [null, v]) : Object.entries(value);
      if (entries.length === 0) {
        return '<div class="jrow">' + keyHtml + open + close + '</div>';
      }
      const inner = entries.map(([k, v]) =>
        jsonToHtml(v, k === null ? '' : '<span class="jkey">"' + escapeHtml(k) + '"</span>: ')
      ).join('');
      return '<details class="jnode" open>' +
        '<summary data-close="' + close + '">' + keyHtml + open + '</summary>' +
        '<div class="jkids">' + inner + '</div>' +
        '<div class="jrow">' + close + '</div>' +
        '</details>';
    }

    function renderJsonInto(el, jsonStr) {
      try {
        el.innerHTML = jsonToHtml(JSON.parse(jsonStr), '');
      } catch (e) {
        el.textContent = jsonStr;
      }
    }

    function fmtDate(sec) {
      try {
        const d = new Date(sec * 1000);
        return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
      } catch (e) { return String(sec); }
    }

    function fmtRel(sec, now) {
      let d = sec - now;
      const future = d >= 0;
      d = Math.abs(d);
      let txt;
      if (d < 60) { txt = d + ' s'; }
      else if (d < 3600) { txt = Math.round(d / 60) + ' min'; }
      else if (d < 86400) { txt = Math.round(d / 3600) + ' godz.'; }
      else if (d < 31536000) {
        const days = Math.round(d / 86400);
        txt = days === 1 ? '1 dzień' : days + ' dni';
      } else {
        const y = Math.round(d / 31536000);
        const last = y % 10, tens = y % 100;
        txt = y + (y === 1 ? ' rok' : (last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? ' lata' : ' lat'));
      }
      return future ? 'za ' + txt : txt + ' temu';
    }

    function renderClaims(payloadObj) {
      const rows = [];
      const now = Math.floor(Date.now() / 1000);

      function row(key, label, valueHtml) {
        rows.push('<div class="claim-row"><span class="claim-key">' + key + '</span>' +
          '<span class="claim-name">' + label + '</span>' +
          '<span class="claim-val">' + valueHtml + '</span></div>');
      }
      function dateVal(sec) {
        return fmtDate(sec) + ' <span class="claim-sub">(' + fmtRel(sec, now) + ')</span>';
      }

      if (typeof payloadObj.exp === 'number') {
        const expired = payloadObj.exp < now;
        row('exp', 'wygasa', dateVal(payloadObj.exp) +
          '<span class="pill ' + (expired ? 'err">wygasł' : 'ok">ważny') + '</span>');
      }
      if (typeof payloadObj.iat === 'number') {
        row('iat', 'wydany', dateVal(payloadObj.iat));
      }
      if (typeof payloadObj.nbf === 'number') {
        row('nbf', 'ważny od', dateVal(payloadObj.nbf) +
          (payloadObj.nbf > now ? '<span class="pill warn">jeszcze nieaktywny</span>' : ''));
      }
      if (payloadObj.iss !== undefined) { row('iss', 'wystawca', escapeHtml(String(payloadObj.iss))); }
      if (payloadObj.sub !== undefined) { row('sub', 'podmiot', escapeHtml(String(payloadObj.sub))); }
      if (payloadObj.aud !== undefined) {
        row('aud', 'odbiorca', escapeHtml(Array.isArray(payloadObj.aud) ? payloadObj.aud.join(', ') : String(payloadObj.aud)));
      }

      return rows.length ? '<div class="claims-box">' + rows.join('') + '</div>' : '';
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
      result.classList.add('hidden');
    }

    function decode() {
      const raw = input.value.trim();
      if (!raw) {
        errorBox.classList.add('hidden');
        result.classList.add('hidden');
        return;
      }
      const parts = raw.split('.');
      if (parts.length < 2 || parts.length > 3) {
        showError('To nie wygląda na JWT — oczekiwano 2–3 części rozdzielonych kropką.');
        return;
      }
      try {
        const headerStr = base64UrlDecode(parts[0]);
        const payloadStr = base64UrlDecode(parts[1]);
        renderJsonInto(headerEl, headerStr);
        renderJsonInto(payloadEl, payloadStr);
        signatureEl.textContent = parts[2] || '(brak podpisu)';

        let claimsHtml = '';
        try { claimsHtml = renderClaims(JSON.parse(payloadStr)); } catch (e) {}
        claimsEl.innerHTML = claimsHtml;

        errorBox.classList.add('hidden');
        result.classList.remove('hidden');
      } catch (e) {
        showError('Nie udało się zdekodować tokenu: ' + (e && e.message ? e.message : e));
      }
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
        showError('Brak dostępu do schowka — wklej token ręcznie (Ctrl/Cmd+V).');
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'setToken') {
        input.value = msg.token;
        decode();
      }
    });

    input.focus();
`;

function getHtml(): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `connect-src 'none'`,
    `img-src 'none'`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JWT Decoder</title>
  <style nonce="${nonce}">${styles}  </style>
</head>
<body>
  <h2>JWT Decoder</h2>

  <textarea id="input" placeholder="Wklej token JWT" spellcheck="false"></textarea>
  <div class="toolbar">
    <button id="paste" class="secondary">Wklej i dekoduj</button>
    <button id="clear" class="secondary">Wyczyść</button>
  </div>

  <div id="error" class="error-box hidden"></div>

  <div id="result" class="hidden">
    <div class="section header">
      <h3>Header
        <button class="mini" data-target="header" data-open="true">Rozwiń wszystko</button>
        <button class="mini" data-target="header" data-open="false">Zwiń wszystko</button>
      </h3>
      <div class="jsonbox" id="header"></div>
    </div>
    <div class="section payload">
      <h3>Payload
        <button class="mini" data-target="payload" data-open="true">Rozwiń wszystko</button>
        <button class="mini" data-target="payload" data-open="false">Zwiń wszystko</button>
      </h3>
      <div class="jsonbox" id="payload"></div>
      <div class="claims" id="claims"></div>
    </div>
    <div class="section sig">
      <h3>Signature</h3>
      <pre id="signature"></pre>
    </div>
  </div>

  <script nonce="${nonce}">${script}  </script>
</body>
</html>`;
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}
