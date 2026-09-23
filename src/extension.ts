import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { looksLikeBase64 } from './base64';
import { escapeHtml, formatSize } from './render';
import { sharedWebviewSource } from './webviewScript';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('base64Preview.open', async () => {
      openPanel(await textFromClipboard());
    }),
    vscode.commands.registerCommand('base64Preview.decodeSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      const selectedText = editor?.document.getText(editor.selection).trim();
      openPanel(selectedText || (await textFromClipboard()));
    })
  );
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}

async function textFromClipboard(): Promise<string | undefined> {
  try {
    const text = (await vscode.env.clipboard.readText()).trim();
    return looksLikeBase64(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

function openPanel(initialText?: string) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    if (initialText) {
      panel.webview.postMessage({ type: 'setInput', text: initialText });
    }
  } else {
    panel = vscode.window.createWebviewPanel(
      'base64Preview',
      'Base64 Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    panel.iconPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'icon.png'));
    panel.webview.html = getHtml(initialText);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void handleWebviewMessage(message);
    });
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }
}

interface SaveRequest {
  type: 'save';
  base64: string;
  fileName: string;
  format: string;
  extension: string;
}

interface OpenInEditorRequest {
  type: 'openInEditor';
  text: string;
  language: string;
}

function asRequest(message: unknown): SaveRequest | OpenInEditorRequest | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }
  const m = message as Record<string, unknown>;
  if (m.type === 'save' && typeof m.base64 === 'string' && typeof m.fileName === 'string' &&
      typeof m.format === 'string' && typeof m.extension === 'string') {
    return { type: 'save', base64: m.base64, fileName: m.fileName, format: m.format, extension: m.extension };
  }
  if (m.type === 'openInEditor' && typeof m.text === 'string' && typeof m.language === 'string') {
    return { type: 'openInEditor', text: m.text, language: m.language };
  }
  return undefined;
}

async function handleWebviewMessage(message: unknown): Promise<void> {
  const request = asRequest(message);
  if (!request) {
    return;
  }
  try {
    if (request.type === 'save') {
      await saveDecodedContent(request);
    } else {
      await openInEditor(request);
    }
  } catch (e) {
    void vscode.window.showErrorMessage('Base64 Preview: ' + (e instanceof Error ? e.message : String(e)));
  }
}

export function safeFileName(name: string, extension: string): string {
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  const ext = extension.replace(/[^A-Za-z0-9]+/g, '').toLowerCase();
  if (base && base !== '_') {
    return base;
  }
  return 'decoded.' + (ext || 'bin');
}

async function saveDecodedContent(request: SaveRequest): Promise<void> {
  const bytes = Buffer.from(request.base64, 'base64');
  const fileName = safeFileName(request.fileName, request.extension);
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(os.homedir());
  const filters: Record<string, string[]> = {};
  const ext = request.extension.replace(/[^A-Za-z0-9]+/g, '').toLowerCase();
  if (ext) {
    filters[request.format || ext.toUpperCase()] = [ext];
  }
  filters['All files'] = ['*'];

  const target = await vscode.window.showSaveDialog({
    title: 'Save decoded content',
    defaultUri: vscode.Uri.joinPath(folder, fileName),
    filters
  });
  if (!target) {
    return;
  }
  await vscode.workspace.fs.writeFile(target, bytes);

  const choice = await vscode.window.showInformationMessage(
    'Saved ' + path.basename(target.fsPath) + ' (' + formatSize(bytes.length) + ').',
    'Open',
    'Reveal in folder'
  );
  if (choice === 'Open') {
    await vscode.commands.executeCommand('vscode.open', target);
  } else if (choice === 'Reveal in folder') {
    await vscode.commands.executeCommand('revealFileInOS', target);
  }
}

async function openInEditor(request: OpenInEditorRequest): Promise<void> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument({ content: request.text, language: request.language });
  } catch {
    document = await vscode.workspace.openTextDocument({ content: request.text, language: 'plaintext' });
  }
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preview: false });
}

const mediaCache = new Map<string, string>();

function readMediaFile(name: string): string {
  let content = mediaCache.get(name);
  if (content === undefined) {
    content = fs.readFileSync(path.join(__dirname, '..', 'media', name), 'utf8');
    mediaCache.set(name, content);
  }
  return content;
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

export function getHtml(initialText?: string): string {
  const nonce = getNonce();
  // Images are rendered from data: URIs built inside the webview; nothing is ever
  // loaded from the network or from disk.
  const csp = [
    `default-src 'none'`,
    `connect-src 'none'`,
    `img-src data:`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  return renderTemplate(readMediaFile('webview.html'), {
    csp,
    nonce,
    styles: readMediaFile('webview.css'),
    script: sharedWebviewSource() + '\n\n' + readMediaFile('webview.js'),
    initialText: initialText ? escapeHtml(initialText) : ''
  });
}
