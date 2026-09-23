export type ContentKind = 'image' | 'text' | 'binary';

export interface FormatInfo {
  /** How the panel can show it: inline image, text, or hex dump only. */
  kind: ContentKind;
  /** Human-readable name, e.g. "PNG image". */
  format: string;
  mime: string;
  /** File extension without the dot, used for the suggested file name. */
  extension: string;
  /** VS Code language id for text formats. */
  language?: string;
}

export interface DetectedContent extends FormatInfo {
  /** Decoded text, present for text formats and for SVG. */
  text?: string;
  encoding?: string;
  isJson?: boolean;
  /** Media type declared by a data: URI, if there was one. */
  declaredMime?: string;
}

// The functions in this module are also shipped to the webview as source text
// (see webviewScript.ts), so they must not reference module-level bindings.

export function formatForMime(mime: string): FormatInfo | undefined {
  const table: Record<string, [ContentKind, string, string, string?]> = {
    'image/png': ['image', 'PNG image', 'png'],
    'image/jpeg': ['image', 'JPEG image', 'jpg'],
    'image/gif': ['image', 'GIF image', 'gif'],
    'image/webp': ['image', 'WebP image', 'webp'],
    'image/bmp': ['image', 'BMP image', 'bmp'],
    'image/x-icon': ['image', 'ICO icon', 'ico'],
    'image/avif': ['image', 'AVIF image', 'avif'],
    'image/svg+xml': ['image', 'SVG image', 'svg', 'xml'],
    'image/heic': ['binary', 'HEIC image', 'heic'],
    'image/tiff': ['binary', 'TIFF image', 'tif'],
    'image/vnd.adobe.photoshop': ['binary', 'Photoshop document', 'psd'],
    'application/pdf': ['binary', 'PDF document', 'pdf'],
    'application/zip': ['binary', 'ZIP archive', 'zip'],
    'application/java-archive': ['binary', 'Java archive', 'jar'],
    'application/gzip': ['binary', 'GZIP archive', 'gz'],
    'application/x-bzip2': ['binary', 'BZIP2 archive', 'bz2'],
    'application/x-xz': ['binary', 'XZ archive', 'xz'],
    'application/x-7z-compressed': ['binary', '7-Zip archive', '7z'],
    'application/vnd.rar': ['binary', 'RAR archive', 'rar'],
    'application/x-tar': ['binary', 'TAR archive', 'tar'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['binary', 'Word document', 'docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['binary', 'Excel workbook', 'xlsx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['binary', 'PowerPoint presentation', 'pptx'],
    'application/x-ole-storage': ['binary', 'Legacy Office document (DOC / XLS / PPT)', 'doc'],
    'audio/mpeg': ['binary', 'MP3 audio', 'mp3'],
    'audio/mp4': ['binary', 'M4A audio', 'm4a'],
    'audio/wav': ['binary', 'WAV audio', 'wav'],
    'audio/ogg': ['binary', 'OGG audio', 'ogg'],
    'audio/flac': ['binary', 'FLAC audio', 'flac'],
    'video/mp4': ['binary', 'MP4 video', 'mp4'],
    'video/webm': ['binary', 'WebM / Matroska video', 'webm'],
    'video/x-msvideo': ['binary', 'AVI video', 'avi'],
    'font/woff': ['binary', 'WOFF font', 'woff'],
    'font/woff2': ['binary', 'WOFF2 font', 'woff2'],
    'font/ttf': ['binary', 'TrueType font', 'ttf'],
    'font/otf': ['binary', 'OpenType font', 'otf'],
    'application/wasm': ['binary', 'WebAssembly module', 'wasm'],
    'application/x-elf': ['binary', 'ELF executable', 'elf'],
    'application/vnd.microsoft.portable-executable': ['binary', 'Windows executable', 'exe'],
    'application/java-vm': ['binary', 'Java class file', 'class'],
    'application/vnd.sqlite3': ['binary', 'SQLite database', 'sqlite'],
    'application/octet-stream': ['binary', 'Binary data', 'bin'],
    'application/json': ['text', 'JSON', 'json', 'json'],
    'application/xml': ['text', 'XML', 'xml', 'xml'],
    'text/html': ['text', 'HTML', 'html', 'html'],
    'text/plain': ['text', 'Plain text', 'txt', 'plaintext'],
    'text/csv': ['text', 'CSV', 'csv', 'plaintext'],
    'text/markdown': ['text', 'Markdown', 'md', 'markdown'],
    'text/css': ['text', 'CSS', 'css', 'css'],
    'text/javascript': ['text', 'JavaScript', 'js', 'javascript'],
    'application/x-yaml': ['text', 'YAML', 'yaml', 'yaml'],
    'text/x-python': ['text', 'Python', 'py', 'python'],
    'application/x-sh': ['text', 'Shell script', 'sh', 'shellscript'],
    'application/x-pem-file': ['text', 'PEM', 'pem', 'plaintext'],
    'application/rtf': ['text', 'RTF document', 'rtf', 'plaintext'],
    'text/calendar': ['text', 'iCalendar', 'ics', 'plaintext'],
    'application/jwt': ['text', 'JSON Web Token', 'txt', 'plaintext']
  };
  const aliases: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'image/vnd.microsoft.icon': 'image/x-icon',
    'image/svg': 'image/svg+xml',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/mp3': 'audio/mpeg',
    'application/x-gzip': 'application/gzip',
    'application/x-zip-compressed': 'application/zip',
    'application/x-rar-compressed': 'application/vnd.rar',
    'text/xml': 'application/xml',
    'text/json': 'application/json',
    'application/javascript': 'text/javascript',
    'text/yaml': 'application/x-yaml',
    'application/yaml': 'application/x-yaml',
    'text/x-yaml': 'application/x-yaml',
    'text/x-markdown': 'text/markdown',
    'application/x-httpd-php': 'text/plain',
    'font/sfnt': 'font/ttf',
    'application/font-woff': 'font/woff',
    'application/x-msdownload': 'application/vnd.microsoft.portable-executable',
    'application/x-sqlite3': 'application/vnd.sqlite3'
  };
  const key = aliases[mime] || mime;
  const entry = table[key];
  if (!entry) {
    return undefined;
  }
  return { kind: entry[0], format: entry[1], mime: key, extension: entry[2], language: entry[3] };
}

/**
 * Identifies well-known binary formats by their leading bytes. Signatures that are
 * plain ASCII and short ("BM", "MZ") could also start ordinary text, so they are
 * only consulted once the bytes have failed to decode as text (`includeWeak`).
 */
export function detectSignature(bytes: Uint8Array, includeWeak: boolean): FormatInfo | undefined {
  function matches(offset: number, pattern: number[]): boolean {
    if (bytes.length < offset + pattern.length) { return false; }
    for (let i = 0; i < pattern.length; i++) {
      if (bytes[offset + i] !== pattern[i]) { return false; }
    }
    return true;
  }
  function ascii(offset: number, text: string): boolean {
    return matches(offset, Array.from(text, c => c.charCodeAt(0)));
  }
  function contains(text: string, limit: number): boolean {
    const needle = Array.from(text, c => c.charCodeAt(0));
    const end = Math.min(bytes.length, limit) - needle.length;
    for (let i = 0; i <= end; i++) {
      if (bytes[i] === needle[0] && matches(i, needle)) { return true; }
    }
    return false;
  }

  if (matches(0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) { return formatForMime('image/png'); }
  if (matches(0, [0xFF, 0xD8, 0xFF])) { return formatForMime('image/jpeg'); }
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) { return formatForMime('image/gif'); }
  if (ascii(0, 'RIFF')) {
    if (ascii(8, 'WEBP')) { return formatForMime('image/webp'); }
    if (ascii(8, 'WAVE')) { return formatForMime('audio/wav'); }
    if (ascii(8, 'AVI ')) { return formatForMime('video/x-msvideo'); }
  }
  if (matches(0, [0x00, 0x00, 0x01, 0x00])) { return formatForMime('image/x-icon'); }
  if (ascii(0, 'II*\u0000') || ascii(0, 'MM\u0000*')) { return formatForMime('image/tiff'); }
  if (ascii(0, '8BPS')) { return formatForMime('image/vnd.adobe.photoshop'); }
  if (ascii(0, '%PDF')) { return formatForMime('application/pdf'); }
  if (matches(0, [0x1F, 0x8B])) { return formatForMime('application/gzip'); }
  if (ascii(0, 'BZh') && bytes.length > 3 && bytes[3] >= 0x31 && bytes[3] <= 0x39) { return formatForMime('application/x-bzip2'); }
  if (matches(0, [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00])) { return formatForMime('application/x-xz'); }
  if (ascii(0, 'PK') && bytes.length > 3 && bytes[2] <= 0x07 && (bytes[3] === bytes[2] + 1)) {
    const limit = 1024 * 1024;
    if (contains('word/', limit)) { return formatForMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'); }
    if (contains('xl/', limit)) { return formatForMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
    if (contains('ppt/', limit)) { return formatForMime('application/vnd.openxmlformats-officedocument.presentationml.presentation'); }
    if (contains('META-INF/MANIFEST.MF', limit)) { return formatForMime('application/java-archive'); }
    return formatForMime('application/zip');
  }
  if (matches(0, [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])) { return formatForMime('application/x-7z-compressed'); }
  if (ascii(0, 'Rar!\u001a\u0007')) { return formatForMime('application/vnd.rar'); }
  if (ascii(257, 'ustar')) { return formatForMime('application/x-tar'); }
  if (ascii(0, 'ID3')) { return formatForMime('audio/mpeg'); }
  if (ascii(0, 'OggS')) { return formatForMime('audio/ogg'); }
  if (ascii(0, 'fLaC')) { return formatForMime('audio/flac'); }
  if (ascii(4, 'ftyp')) {
    if (ascii(8, 'avif') || ascii(8, 'avis')) { return formatForMime('image/avif'); }
    if (ascii(8, 'heic') || ascii(8, 'heix') || ascii(8, 'mif1')) { return formatForMime('image/heic'); }
    if (ascii(8, 'M4A ')) { return formatForMime('audio/mp4'); }
    return formatForMime('video/mp4');
  }
  if (matches(0, [0x1A, 0x45, 0xDF, 0xA3])) { return formatForMime('video/webm'); }
  if (ascii(0, 'wOFF')) { return formatForMime('font/woff'); }
  if (ascii(0, 'wOF2')) { return formatForMime('font/woff2'); }
  if (ascii(0, 'OTTO')) { return formatForMime('font/otf'); }
  if (matches(0, [0x00, 0x01, 0x00, 0x00])) { return formatForMime('font/ttf'); }
  if (matches(0, [0x7F, 0x45, 0x4C, 0x46])) { return formatForMime('application/x-elf'); }
  if (matches(0, [0x00, 0x61, 0x73, 0x6D])) { return formatForMime('application/wasm'); }
  if (matches(0, [0xCA, 0xFE, 0xBA, 0xBE])) { return formatForMime('application/java-vm'); }
  if (ascii(0, 'SQLite format 3\u0000')) { return formatForMime('application/vnd.sqlite3'); }
  if (matches(0, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) { return formatForMime('application/x-ole-storage'); }

  if (!includeWeak) {
    return undefined;
  }
  if (ascii(0, 'BM')) { return formatForMime('image/bmp'); }
  if (ascii(0, 'MZ')) { return formatForMime('application/vnd.microsoft.portable-executable'); }
  if (bytes.length > 1 && bytes[0] === 0xFF && (bytes[1] & 0xE6) === 0xE2) { return formatForMime('audio/mpeg'); }
  return undefined;
}

/**
 * Decodes the bytes as text if they are valid UTF-8 (or UTF-16 with a BOM) and
 * contain no control characters other than tab, newline, carriage return and form feed.
 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } | undefined {
  let encoding = 'utf-8';
  let body = bytes;
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    encoding = 'utf-16le';
    body = bytes.subarray(2);
  } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    encoding = 'utf-16be';
    body = bytes.subarray(2);
  } else if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    body = bytes.subarray(3);
  }
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(body);
  } catch (e) {
    return undefined;
  }
  if (/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/.test(text)) {
    return undefined;
  }
  return { text, encoding };
}

/** Names the text format by its content, falling back to a declared media type. */
export function classifyText(text: string, declaredMime?: string): FormatInfo & { isJson?: boolean } {
  const head = text.slice(0, 4096).trimStart();
  if (/^[[{]/.test(head)) {
    try {
      JSON.parse(text);
      return Object.assign({}, formatForMime('application/json'), { isJson: true });
    } catch (e) { /* not JSON */ }
  }
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return formatForMime('image/svg+xml') as FormatInfo;
  }
  if (/^(<!DOCTYPE\s+html|<html[\s>])/i.test(head)) {
    return formatForMime('text/html') as FormatInfo;
  }
  if (/^<\?xml/i.test(head)) {
    return formatForMime('application/xml') as FormatInfo;
  }
  if (/^-----BEGIN [A-Z0-9 ]+-----/.test(head)) {
    return formatForMime('application/x-pem-file') as FormatInfo;
  }
  if (/^\{\\rtf/.test(head)) {
    return formatForMime('application/rtf') as FormatInfo;
  }
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]*)?\s*$/.test(text)) {
    return formatForMime('application/jwt') as FormatInfo;
  }
  if (declaredMime) {
    const declared = formatForMime(declaredMime);
    if (declared && declared.kind === 'text') {
      return declared;
    }
  }
  return formatForMime('text/plain') as FormatInfo;
}

/**
 * Works out what the decoded bytes are. Strong binary signatures win, then text,
 * then weak signatures, then whatever a data: URI declared, then "binary data".
 */
export function detectContent(bytes: Uint8Array, declaredMime?: string): DetectedContent {
  const declared = declaredMime ? declaredMime.toLowerCase() : undefined;
  function finish(info: FormatInfo, extra?: Partial<DetectedContent>): DetectedContent {
    const out: DetectedContent = Object.assign({}, info, extra || {});
    if (declared) { out.declaredMime = declared; }
    return out;
  }

  const strong = detectSignature(bytes, false);
  if (strong) {
    return finish(strong);
  }
  const decoded = decodeText(bytes);
  if (decoded) {
    const classified = classifyText(decoded.text, declared);
    return finish(classified, { text: decoded.text, encoding: decoded.encoding, isJson: classified.isJson === true });
  }
  const weak = detectSignature(bytes, true);
  if (weak) {
    return finish(weak);
  }
  const fromDeclared = declared ? formatForMime(declared) : undefined;
  if (fromDeclared && fromDeclared.kind === 'binary') {
    return finish(fromDeclared);
  }
  return finish({ kind: 'binary', format: 'Binary data', mime: 'application/octet-stream', extension: 'bin' });
}
