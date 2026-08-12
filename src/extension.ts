import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { escapeHtml, fmtDate, fmtRel, jsonToHtml, renderClaims, renderPlain } from './render';
import { base64UrlDecode, parseToken } from './token';

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

export function deactivate() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}

function openPanel(initialToken?: string) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    if (initialToken) {
      panel.webview.postMessage({ type: 'setToken', token: initialToken });
    }
  } else {
    panel = vscode.window.createWebviewPanel(
      'jwtDecoder',
      'JWT Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    panel.iconPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'icon.png'));
    panel.webview.html = getHtml(initialToken);
    panel.onDidDispose(() => {
      panel = undefined;
    });
  }
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

const SHARED_WEBVIEW_FUNCTIONS = [
  escapeHtml,
  base64UrlDecode,
  parseToken,
  jsonToHtml,
  fmtDate,
  fmtRel,
  renderClaims,
  renderPlain
];

function getWebviewScript(): string {
  const sharedSources = SHARED_WEBVIEW_FUNCTIONS.map(fn => fn.toString()).join('\n\n');
  return sharedSources + '\n\n' + readMediaFile('webview.js');
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
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

  return renderTemplate(readMediaFile('webview.html'), {
    csp,
    nonce,
    styles: readMediaFile('webview.css'),
    script: getWebviewScript(),
    initialToken: initialToken ? escapeHtml(initialToken) : ''
  });
}
