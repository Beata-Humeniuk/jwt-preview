import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { escapeHtml } from './render';
import { sharedWebviewSource } from './shared';
import { looksLikeJwt } from './token';
import { verifySignature } from './verify';

const PANEL_VIEW_TYPE = 'jwtDecoder';
const PANEL_TITLE = 'JWT Preview';
const NO_JWT_IN_CLIPBOARD =
  'The clipboard does not contain a JWT. Copy a token and run the command again, or paste it into the panel.';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jwtDecoder.open', async () => {
      openPanel(await tokenFromClipboard());
    }),
    vscode.commands.registerCommand('jwtDecoder.decodeClipboard', async () => {
      const token = await tokenFromClipboard();
      if (!token) {
        void vscode.window.showWarningMessage(NO_JWT_IN_CLIPBOARD);
      }
      openPanel(token);
    })
  );
}

export function deactivate() {
  panel?.dispose();
  panel = undefined;
}

async function tokenFromClipboard(): Promise<string | undefined> {
  try {
    const text = (await vscode.env.clipboard.readText()).trim();
    return looksLikeJwt(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

function openPanel(initialToken?: string): void {
  if (!panel) {
    panel = createPanel(initialToken);
    return;
  }
  panel.reveal(vscode.ViewColumn.Beside);
  if (initialToken) {
    panel.webview.postMessage({ type: 'setToken', token: initialToken });
  }
}

function createPanel(initialToken?: string): vscode.WebviewPanel {
  const created = vscode.window.createWebviewPanel(PANEL_VIEW_TYPE, PANEL_TITLE, vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: []
  });
  created.iconPath = vscode.Uri.file(mediaPath('icon.png'));
  created.webview.html = getHtml(initialToken);
  created.webview.onDidReceiveMessage(handleWebviewMessage);
  created.onDidDispose(() => {
    panel = undefined;
  });
  return created;
}

interface VerifyRequest {
  requestId: number;
  token: string;
  key: string;
  base64Secret?: boolean;
}

function asVerifyRequest(message: unknown): VerifyRequest | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }
  const m = message as Record<string, unknown>;
  if (m.type !== 'verify' || typeof m.requestId !== 'number' ||
      typeof m.token !== 'string' || typeof m.key !== 'string') {
    return undefined;
  }
  return { requestId: m.requestId, token: m.token, key: m.key, base64Secret: m.base64Secret === true };
}

function handleWebviewMessage(message: unknown): void {
  const request = asVerifyRequest(message);
  if (!request) {
    return;
  }
  const result = verifySignature(request.token, request.key, { base64Secret: request.base64Secret });
  panel?.webview.postMessage({ type: 'verifyResult', requestId: request.requestId, result });
}

function mediaPath(name: string): string {
  return path.join(__dirname, '..', 'media', name);
}

const mediaCache = new Map<string, string>();

function readMediaFile(name: string): string {
  let content = mediaCache.get(name);
  if (content === undefined) {
    content = fs.readFileSync(mediaPath(name), 'utf8');
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
    script: sharedWebviewSource() + '\n\n' + readMediaFile('webview.js'),
    initialToken: initialToken ? escapeHtml(initialToken) : ''
  });
}
