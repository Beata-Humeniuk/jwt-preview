const input = document.getElementById('input');
const errorBox = document.getElementById('error');
const result = document.getElementById('result');
const formatEl = document.getElementById('format');
const mimeEl = document.getElementById('mime');
const sizeEl = document.getElementById('size');
const dimsEl = document.getElementById('dims');
const encodingEl = document.getElementById('encoding');
const alphabetEl = document.getElementById('alphabet');
const dataUriEl = document.getElementById('datauri');
const declaredEl = document.getElementById('declared');
const viewBar = document.getElementById('viewbar');
const viewMode = document.getElementById('viewmode');
const imageWrap = document.getElementById('image-wrap');
const imageEl = document.getElementById('image');
const imageError = document.getElementById('image-error');
const jsonWrap = document.getElementById('json-wrap');
const jsonEl = document.getElementById('json');
const textWrap = document.getElementById('text-wrap');
const textEl = document.getElementById('text');
const textNote = document.getElementById('text-note');
const binaryNote = document.getElementById('binary-note');
const hexEl = document.getElementById('hex');
const hexNote = document.getElementById('hex-note');
const saveBtn = document.getElementById('save');
const openEditorBtn = document.getElementById('openeditor');
const copyTextBtn = document.getElementById('copytext');
const copyJsonBtn = document.getElementById('copyjson');
const vscode = acquireVsCodeApi();

const TEXT_PREVIEW_LIMIT = 200000;
const HEX_DUMP_LIMIT = 4096;

let current = null;

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  result.classList.add('hidden');
  current = null;
}

function hideAll() {
  errorBox.classList.add('hidden');
  result.classList.add('hidden');
  imageEl.removeAttribute('src');
  current = null;
}

function setPill(el, text) {
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}

function setHexMode(on) {
  result.classList.toggle('hex-mode', on);
  viewMode.checked = on;
}

function renderSummary(normalized, bytes, info) {
  formatEl.textContent = info.format;
  mimeEl.textContent = info.mime;
  sizeEl.textContent = formatSize(bytes.length) + (bytes.length >= 1024 ? ' (' + bytes.length.toLocaleString('en-US') + ' bytes)' : '');
  setPill(dimsEl, '');
  setPill(encodingEl, info.encoding && info.encoding !== 'utf-8' ? info.encoding.toUpperCase() : '');
  alphabetEl.classList.toggle('hidden', !normalized.urlSafe);
  dataUriEl.classList.toggle('hidden', !normalized.fromDataUri);
  const mismatch = info.declaredMime && info.declaredMime !== info.mime && info.declaredMime !== 'application/octet-stream';
  setPill(declaredEl, mismatch ? 'declared as ' + info.declaredMime : '');
}

function renderPreview(info, base64) {
  imageWrap.classList.add('hidden');
  imageError.classList.add('hidden');
  jsonWrap.classList.add('hidden');
  textWrap.classList.add('hidden');
  binaryNote.classList.add('hidden');
  textNote.classList.add('hidden');
  imageEl.removeAttribute('src');

  if (info.kind === 'image') {
    imageWrap.classList.remove('hidden');
    imageEl.src = 'data:' + info.mime + ';base64,' + base64;
  }
  if (info.isJson) {
    jsonWrap.classList.remove('hidden');
    try {
      jsonEl.innerHTML = jsonToHtml(JSON.parse(info.text), '');
    } catch (e) {
      jsonEl.textContent = info.text;
    }
  } else if (typeof info.text === 'string') {
    textWrap.classList.remove('hidden');
    if (info.text.length > TEXT_PREVIEW_LIMIT) {
      textEl.textContent = info.text.slice(0, TEXT_PREVIEW_LIMIT);
      textNote.textContent = 'Showing the first ' + TEXT_PREVIEW_LIMIT.toLocaleString('en-US') +
        ' of ' + info.text.length.toLocaleString('en-US') + ' characters. Open it in the editor to see everything.';
      textNote.classList.remove('hidden');
    } else {
      textEl.textContent = info.text;
    }
  }

  const previewable = info.kind === 'image' || typeof info.text === 'string';
  viewBar.classList.toggle('hidden', !previewable);
  if (!previewable) {
    binaryNote.textContent = info.format === 'Binary data'
      ? 'No known file signature was found, so there is no inline preview. The hex dump below shows the raw bytes; you can still save them as a file.'
      : 'There is no inline preview for a ' + info.format + '. Save it as a file to open it in a suitable application.';
    binaryNote.classList.remove('hidden');
  }
  setHexMode(!previewable);

  openEditorBtn.classList.toggle('hidden', typeof info.text !== 'string');
  copyTextBtn.classList.toggle('hidden', typeof info.text !== 'string');
}

function renderHex(bytes) {
  hexEl.textContent = hexDump(bytes, HEX_DUMP_LIMIT);
  if (bytes.length > HEX_DUMP_LIMIT) {
    hexNote.textContent = 'Showing the first ' + formatSize(HEX_DUMP_LIMIT) + ' of ' + formatSize(bytes.length) + '.';
    hexNote.classList.remove('hidden');
  } else {
    hexNote.classList.add('hidden');
  }
}

function decode() {
  const normalized = normalizeBase64(input.value);
  if (normalized.kind === 'empty') {
    hideAll();
    return;
  }
  if (normalized.kind === 'invalid') {
    showError(normalized.message);
    return;
  }
  let bytes;
  try {
    bytes = decodeBase64(normalized.base64);
  } catch (e) {
    showError('Failed to decode the text: ' + (e && e.message ? e.message : String(e)));
    return;
  }
  const info = detectContent(bytes, normalized.mimeHint);
  current = { base64: normalized.base64, bytes, info };

  renderSummary(normalized, bytes, info);
  renderPreview(info, normalized.base64);
  renderHex(bytes);

  errorBox.classList.add('hidden');
  result.classList.remove('hidden');
}

imageEl.addEventListener('load', () => {
  if (imageEl.naturalWidth && imageEl.naturalHeight) {
    setPill(dimsEl, imageEl.naturalWidth + ' × ' + imageEl.naturalHeight + ' px');
  }
});
imageEl.addEventListener('error', () => {
  if (imageEl.getAttribute('src')) {
    imageError.classList.remove('hidden');
  }
});

function flashCopied(btn) {
  btn.classList.add('copied');
  setTimeout(() => btn.classList.remove('copied'), 1500);
}

saveBtn.addEventListener('click', () => {
  if (!current) { return; }
  vscode.postMessage({
    type: 'save',
    base64: current.base64,
    fileName: 'decoded.' + current.info.extension,
    format: current.info.format,
    extension: current.info.extension
  });
});

openEditorBtn.addEventListener('click', () => {
  if (!current || typeof current.info.text !== 'string') { return; }
  vscode.postMessage({ type: 'openInEditor', text: current.info.text, language: current.info.language || 'plaintext' });
});

copyTextBtn.addEventListener('click', async () => {
  if (!current || typeof current.info.text !== 'string') { return; }
  try {
    await navigator.clipboard.writeText(current.info.text);
    flashCopied(copyTextBtn);
  } catch (e) {}
});

copyJsonBtn.addEventListener('click', async () => {
  if (!current || typeof current.info.text !== 'string') { return; }
  let text = current.info.text;
  try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
  try {
    await navigator.clipboard.writeText(text);
    flashCopied(copyJsonBtn);
  } catch (e) {}
});

document.querySelectorAll('button.mini[data-open]').forEach(btn => {
  btn.addEventListener('click', () => {
    jsonEl.querySelectorAll('details').forEach(d => { d.open = btn.dataset.open === 'true'; });
  });
});

viewMode.addEventListener('change', () => {
  result.classList.toggle('hex-mode', viewMode.checked);
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
    showError('No clipboard access — paste the text manually (Ctrl/Cmd+V).');
  }
});

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg && msg.type === 'setInput' && typeof msg.text === 'string') {
    input.value = msg.text;
    decode();
  }
});

decode();
input.focus();
