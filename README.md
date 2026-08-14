# JWT Preview

A Visual Studio Code extension for viewing JWT token contents in a clear,
readable format. Paste a token or select one in the editor to inspect its
Header and Payload as readable JSON, with standard claims formatted for quick
reading. If you have the signing key, the panel can also check the signature —
without sending anything anywhere.

![The JWT Preview panel showing a decoded synthetic token](media/screenshot.png)

## Privacy

No telemetry. No network requests. Tokens and keys are never stored.

Decoding happens on your machine, inside a webview whose Content Security
Policy blocks network access entirely (`default-src 'none'`,
`connect-src 'none'`). Signature verification runs in the extension itself,
using the Node runtime that ships with VS Code, because that is what reads PEM
and JWK key material; the key travels no further than that. Nothing is fetched
over the network at any point — in particular, a `jku` or `x5u` URL in a token
header is never followed.

The extension has no runtime dependencies, reads the clipboard only when you
press the paste button, and does not retain any data after the panel is
closed. The key field starts empty every time and its contents are never
written to disk or to workspace state.

## Features

- Live decoding as you type or paste.
- Header and Payload rendered as a collapsible JSON tree; the Signature
  segment is displayed as-is.
- Standard claims formatted where present: `exp`, `iat`, `nbf`, `iss`, `sub`,
  `aud` — with UTC timestamps, relative times, and expiration status.
- Correct Base64URL and UTF-8 handling, including non-Latin characters.
- Optional signature verification against a key you supply (see below).
- Follows the editor theme (light, dark, high contrast).

## Verifying a signature

Verification is optional. Leave the key field empty and the extension only
decodes and displays. Paste a key into it and the panel reports whether the
signature matches.

Supported algorithms:

| Family | Algorithms | Key to supply |
| --- | --- | --- |
| HMAC | `HS256`, `HS384`, `HS512` | the shared secret, as text or Base64 |
| RSA | `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512` | an RSA public key |
| ECDSA | `ES256`, `ES384`, `ES512` | an EC public key on P-256, P-384 or P-521 |
| EdDSA | `EdDSA` | an Ed25519 or Ed448 public key |

Public keys are accepted as PEM — a `PUBLIC KEY`, an `RSA PUBLIC KEY`, or a
`CERTIFICATE` to read the key from — as a JWK, or as a JWK Set, in which case
the key matching the token's `kid` is used. A PEM private key also works; the
public half is derived from it. The key field is not stored between sessions.

A result of **signature valid** means the token was signed by the key you
supplied and has not been altered since. It is not a full validity check: the
`exp` and `nbf` claims are displayed with their status, but they are not
enforced, and neither the issuer nor the audience is checked against anything.
Tokens with no signature — including `alg: none` — are reported as unsigned
rather than as valid.

The algorithm is taken from the token's own header, as in any token viewer, so
a result here tells you whether the token matches a key you already trust. It
is a reading aid rather than an authentication decision, and no substitute for
verification inside the system that consumes the token.

## What it does not do

The extension makes no network requests, so it cannot fetch a key for you: a
`jku` or `x5u` URL in a token header is ignored, and a JWKS has to be pasted
in rather than downloaded. It does not enforce claims, does not sign or create
tokens, and does not remember tokens or keys after the panel is closed.

## Usage

Open the Command Palette (`Ctrl/Cmd+Shift+P`), run **JWT: Open Preview**, and
paste a token into the input field.

To decode a token that is already in your editor: select it, right-click, and
choose **JWT: Decode Selected Token**.

To check a signature, paste the key or secret into the **Verify signature**
field below the token; the result appears directly underneath it. Leaving that
field empty skips verification entirely.

## Installation

Install "JWT Preview" from the Visual Studio Code Marketplace, or download a
`.vsix` from the repository's Releases page and install it via
`Extensions: Install from VSIX...`.

## Feedback and security

- Bugs and feature requests: [GitHub Issues](https://github.com/Beata-Humeniuk/jwt-preview/issues)
- Security issues: see [SECURITY.md](SECURITY.md) — please never include real
  tokens in reports.

## Development

```bash
npm install
npm run compile   # compile TypeScript to out/
npm run watch     # compile in watch mode
npm test          # run the test suite
npm run package   # build the .vsix
```

To run the extension for testing, open this folder in VS Code and press `F5`
(Extension Development Host).

## License

[MIT](LICENSE) — see also the [changelog](CHANGELOG.md).
