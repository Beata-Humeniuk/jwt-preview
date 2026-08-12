# Changelog

All notable, user-visible changes to JWT Preview are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-12

### Added

- Local decoding of JWT Header and Payload, with the Signature segment
  displayed as-is.
- Readable formatting of standard claims: `exp`, `iat`, `nbf`, `iss`, `sub`,
  `aud`, including expiration status and relative times.
- Decoding a selected token from the editor context menu.
- Strict webview isolation: no network access, no local resource access, no
  token storage.
