# Changelog

All notable, user-visible changes to JWT Preview are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-08-17

### Changed

- `README.md` no longer restates the security policy. The Privacy section keeps
  the short claim — no telemetry, no network requests, nothing stored — and
  points at `SECURITY.md` for the rest. The build instructions, which are of no
  use to someone installing the extension, are gone from the readme.

## [1.2.0] - 2026-08-14

### Added

- Optional signature verification. Paste a key next to a token and the panel
  reports whether the signature matches, with the result shown directly beneath
  the key field. Supports HS256/384/512, RS256/384/512, PS256/384/512,
  ES256/384/512 and EdDSA, with the key given as an HMAC secret (plain or
  Base64), a PEM public key, certificate or private key, or a JWK or JWK Set —
  from which the entry matching the token's `kid` is chosen.
- Verification is local and stays offline: keys are never stored, and no
  network request is made, so a `jku` or `x5u` URL in a token header is never
  followed.
- The token's `alg` is shown beside the verification field, and tokens that
  carry no signature — including `alg: none` — are reported as unsigned rather
  than as valid.

### Changed

- The documentation no longer presents the absence of signature verification as
  a design decision. `README.md` and `SECURITY.md` now describe what a
  verification result does and does not tell you.

## [1.1.0] - 2026-08-13

### Added

- A Simple view alongside the raw JSON view: a human-readable,
  collapsible list of Header and Payload fields with friendly labels
  for standard claims, formatted dates, and validity indicators —
  switchable per token with a toggle.
- A copy-to-clipboard button for the decoded Header and Payload JSON.
- A panel tab icon.

## [1.0.0] - 2026-08-12

### Added

- Local decoding of JWT Header and Payload, with the Signature segment
  displayed as-is.
- Readable formatting of standard claims: `exp`, `iat`, `nbf`, `iss`, `sub`,
  `aud`, including expiration status and relative times.
- Decoding a selected token from the editor context menu.
- Strict webview isolation: no network access, no local resource access, no
  token storage.
