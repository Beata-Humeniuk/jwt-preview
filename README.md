# JWT Decoder

A VS Code extension for decoding JWT tokens — **100% locally**.

## Privacy guarantee

The token is **never sent anywhere**. Decoding happens exclusively inside a
Webview sandbox with the following Content Security Policy (CSP):

```
default-src 'none'; connect-src 'none'; img-src 'none'
```

`connect-src 'none'` physically blocks `fetch`, `XMLHttpRequest`, `WebSocket`
and any other network request. The extension also has no runtime dependencies
and no code that makes network connections.

## Features

- Live decoding of the **Header**, **Payload**, and **Signature** (as you type).
- Readable formatting of standard claims:
  - `exp` — expiration date + status (ważny / **WYGASŁ**),
  - `iat` — issued-at date,
  - `nbf` — not valid before (with a warning if not yet active),
  - `iss`, `sub`, `aud`.
- Correct UTF-8 decoding (base64url).
- Matches the VS Code theme (light/dark).

> Note: the extension **does not verify the signature** — that would require
> the key/secret. It only shows the token's contents.

## Usage

1. Command Palette (`Cmd/Ctrl+Shift+P`) → **JWT: Otwórz dekoder**.
2. Paste a token and read the decoded contents.

Or: select a token in the editor → right-click → **JWT: Dekoduj zaznaczony token**.

## Development

```bash
npm install
npm run compile      # compile TypeScript -> out/
npm run watch        # watch mode
npm run package      # build the .vsix (vsce)
```

To run for testing: open the folder in VS Code and press `F5`
(Extension Development Host).
