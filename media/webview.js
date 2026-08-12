const input = document.getElementById('input');
const errorBox = document.getElementById('error');
const result = document.getElementById('result');
const headerEl = document.getElementById('header');
const payloadEl = document.getElementById('payload');
const headerPlainEl = document.getElementById('header-plain');
const payloadPlainEl = document.getElementById('payload-plain');
const signatureEl = document.getElementById('signature');
const claimsEl = document.getElementById('claims');
const viewMode = document.getElementById('viewmode');

function renderJsonInto(el, jsonStr) {
  try {
    el.innerHTML = jsonToHtml(JSON.parse(jsonStr), '');
  } catch (e) {
    el.textContent = jsonStr;
  }
}

function renderPlainInto(el, jsonStr, now) {
  try {
    el.innerHTML = renderPlain(JSON.parse(jsonStr), now);
  } catch (e) {
    el.textContent = jsonStr;
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  result.classList.add('hidden');
}

let currentStrs = { header: '', payload: '' };

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
  currentStrs = { header: parsed.headerStr, payload: parsed.payloadStr };
  const now = Math.floor(Date.now() / 1000);
  renderJsonInto(headerEl, parsed.headerStr);
  renderJsonInto(payloadEl, parsed.payloadStr);
  renderPlainInto(headerPlainEl, parsed.headerStr, now);
  renderPlainInto(payloadPlainEl, parsed.payloadStr, now);
  signatureEl.textContent = parsed.signature || '(no signature)';

  let claimsHtml = '';
  try { claimsHtml = renderClaims(JSON.parse(parsed.payloadStr), now); } catch (e) {}
  claimsEl.innerHTML = claimsHtml;

  errorBox.classList.add('hidden');
  result.classList.remove('hidden');
}

const sectionBoxes = {
  header: [headerEl, headerPlainEl],
  payload: [payloadEl, payloadPlainEl]
};
document.querySelectorAll('button.mini').forEach(btn => {
  btn.addEventListener('click', () => {
    sectionBoxes[btn.dataset.target].forEach(box => {
      box.querySelectorAll('details').forEach(d => { d.open = btn.dataset.open === 'true'; });
    });
  });
});

document.querySelectorAll('button.copybtn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const raw = currentStrs[btn.dataset.copy];
    let text = raw;
    try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) {}
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    } catch (e) {}
  });
});

viewMode.addEventListener('change', () => {
  result.classList.toggle('plain-mode', viewMode.checked);
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
