# Security Policy

## Supported versions

Only the latest published version of JWT Preview receives security fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository
(Security → Report a vulnerability). Do not disclose vulnerability details
in a public issue. If private reporting is unavailable, open a public issue
requesting a private reporting channel without including technical or
sensitive details.

When reporting:

- Do **not** include real JWT tokens, production data, signing keys, or any
  sensitive payloads in issues or reports.
- Reproduce the problem using synthetic tokens only. Use a synthetic token
  built from made-up JSON values and Base64URL-encoded segments, signed with a
  throwaway key generated for the report.
- You will never be asked to send a real token or a real key by email or any
  other channel.

## Scope notes

JWT Preview decodes token contents locally and can verify a signature against
a key you supply. It makes no network requests and stores neither tokens nor
keys; keys are held in memory only while the panel is open.

Signature verification uses the `alg` value from the token's own header to
choose the algorithm, and reports the result to the person reading the panel.
This is deliberate — the panel is a reading aid for a human, not an
authentication gate — so reports that the header's `alg` is trusted are out of
scope. Reports that a signature is shown as valid when it is not, that an
unsigned token (including `alg: none`) is reported as valid, or that key
material is written to disk or leaves the machine, are in scope and welcome.
