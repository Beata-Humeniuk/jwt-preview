# Security Policy

## Supported versions

Only the latest published version of JWT Decoder receives security fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository
(Security → Report a vulnerability). Do not disclose vulnerability details
in a public issue. If private reporting is unavailable, open a public issue
requesting a private reporting channel without including technical or
sensitive details.

When reporting:

- Do **not** include real JWT tokens, production data, or any sensitive
  payloads in issues or reports.
- Reproduce the problem using synthetic tokens only. Use a synthetic token
  built from made-up JSON values and Base64URL-encoded segments.
- You will never be asked to send a real token by email or any other channel.

## Scope notes

JWT Decoder decodes token contents locally. It makes no network requests,
stores no tokens, and does not verify signatures. Reports about the absence of
signature verification are out of scope — it is a documented design decision,
not a defect.
