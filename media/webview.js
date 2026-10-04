// Runs inside the webview, after the shared functions from src/render.ts and
// src/token.ts that the extension host prepends to this file.

const inputEl = document.getElementById('input');
const errorEl = document.getElementById('error');
const resultEl = document.getElementById('result');
const headerEl = document.getElementById('header');
const payloadEl = document.getElementById('payload');
const headerPlainEl = document.getElementById('header-plain');
const payloadPlainEl = document.getElementById('payload-plain');
const signatureEl = document.getElementById('signature');
const claimsEl = document.getElementById('claims');
const viewModeEl = document.getElementById('viewmode');
const keyEl = document.getElementById('key');
const b64El = document.getElementById('b64secret');
const b64WrapEl = document.getElementById('b64wrap');
const verifyAlgEl = document.getElementById('verify-alg');
const verifyResultEl = document.getElementById('verify-result');
const verifyIconEl = document.getElementById('verify-icon');
const verifyHeadlineEl = document.getElementById('verify-headline');
const verifyMsgEl = document.getElementById('verify-msg');
const vscode = acquireVsCodeApi();

const sectionBoxes = {
  header: [headerEl, headerPlainEl],
  payload: [payloadEl, payloadPlainEl]
};

let currentStrs = { header: '', payload: '' };
// Incremented on every verify request and on every re-decode, so a late
// answer to an outdated request is ignored.
let verifySeq = 0;

const VERIFY_LABELS = {
  pending: { text: 'Checking…', cls: 'pending', icon: '' },
  valid: { text: 'Signature valid', cls: 'ok', icon: '✓' },
  invalid: { text: 'Signature invalid', cls: 'bad', icon: '✕' },
  unsigned: { text: 'Nothing to verify', cls: 'warn', icon: '!' },
  unsupported: { text: 'Unsupported algorithm', cls: 'warn', icon: '!' },
  error: { text: 'Cannot check', cls: 'warn', icon: '!' }
};

function parseJsonOrUndefined(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return undefined;
  }
}

function setVerifyStatus(status) {
  if (!status) {
    verifyResultEl.className = 'verify-result hidden';
    return;
  }
  const label = VERIFY_LABELS[status.status] || VERIFY_LABELS.error;
  verifyResultEl.className = 'verify-result ' + label.cls;
  verifyIconEl.textContent = label.icon;
  verifyHeadlineEl.textContent = label.text;
  verifyMsgEl.textContent = status.message || '';
}

function requestVerify() {
  const token = inputEl.value.trim();
  const key = keyEl.value.trim();
  const requestId = ++verifySeq;
  if (!token || !key) {
    setVerifyStatus(null);
    return;
  }
  setVerifyStatus({ status: 'pending' });
  vscode.postMessage({ type: 'verify', requestId, token, key, base64Secret: b64El.checked });
}

function renderInto(el, jsonStr, render) {
  const value = parseJsonOrUndefined(jsonStr);
  if (value === undefined) {
    el.textContent = jsonStr;
  } else {
    el.innerHTML = render(value);
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
}

function resetVerification() {
  verifyAlgEl.textContent = '';
  b64WrapEl.classList.add('hidden');
  setVerifyStatus(null);
  verifySeq++;
}

function renderDecoded(parsed) {
  const now = Math.floor(Date.now() / 1000);
  currentStrs = { header: parsed.headerStr, payload: parsed.payloadStr };

  renderInto(headerEl, parsed.headerStr, value => jsonToHtml(value, ''));
  renderInto(payloadEl, parsed.payloadStr, value => jsonToHtml(value, ''));
  renderInto(headerPlainEl, parsed.headerStr, value => renderPlain(value, now));
  renderInto(payloadPlainEl, parsed.payloadStr, value => renderPlain(value, now));
  signatureEl.textContent = parsed.signature || '(no signature)';

  const payload = parseJsonOrUndefined(parsed.payloadStr);
  claimsEl.innerHTML = payload && typeof payload === 'object' ? renderClaims(payload, now) : '';

  const header = parseJsonOrUndefined(parsed.headerStr);
  const alg = header && typeof header.alg === 'string' ? header.alg : '';
  verifyAlgEl.textContent = alg;
  b64WrapEl.classList.toggle('hidden', !alg.startsWith('HS'));
  requestVerify();

  errorEl.classList.add('hidden');
  resultEl.classList.remove('hidden');
}

function decode() {
  const parsed = parseToken(inputEl.value);
  resetVerification();
  switch (parsed.kind) {
    case 'empty':
      errorEl.classList.add('hidden');
      resultEl.classList.add('hidden');
      break;
    case 'invalid':
      showError("This doesn't look like a JWT — expected 2–3 parts separated by a dot.");
      break;
    case 'error':
      showError('Failed to decode the token: ' + parsed.message);
      break;
    default:
      renderDecoded(parsed);
  }
}

function formatForCopy(jsonStr) {
  const value = parseJsonOrUndefined(jsonStr);
  return value === undefined ? jsonStr : JSON.stringify(value, null, 2);
}

document.querySelectorAll('button.mini[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const open = btn.dataset.open === 'true';
    sectionBoxes[btn.dataset.target].forEach(box => {
      box.querySelectorAll('details').forEach(details => { details.open = open; });
    });
  });
});

document.querySelectorAll('button.copybtn').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formatForCopy(currentStrs[btn.dataset.copy]));
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    } catch {
      // Clipboard access denied: the button simply does not flash as copied.
    }
  });
});

viewModeEl.addEventListener('change', () => {
  resultEl.classList.toggle('plain-mode', viewModeEl.checked);
});

inputEl.addEventListener('input', decode);
document.getElementById('clear').addEventListener('click', () => {
  inputEl.value = '';
  decode();
  inputEl.focus();
});
document.getElementById('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    inputEl.value = text.trim();
    decode();
  } catch {
    showError('No clipboard access — paste the token manually (Ctrl/Cmd+V).');
  }
});

keyEl.addEventListener('input', requestVerify);
b64El.addEventListener('change', requestVerify);
document.getElementById('clearkey').addEventListener('click', () => {
  keyEl.value = '';
  requestVerify();
  keyEl.focus();
});

window.addEventListener('message', event => {
  const msg = event.data;
  if (!msg) {
    return;
  }
  if (msg.type === 'setToken') {
    inputEl.value = msg.token;
    decode();
  } else if (msg.type === 'verifyResult' && msg.requestId === verifySeq) {
    setVerifyStatus(msg.result);
  }
});

decode();
inputEl.focus();
