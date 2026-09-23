# Security Policy

## Supported versions

Only the latest published version of Base64 Preview receives security fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository
(Security → Report a vulnerability). Do not disclose vulnerability details
in a public issue. If private reporting is unavailable, open a public issue
requesting a private reporting channel without including technical or
sensitive details.

When reporting:

- Do **not** include real documents, credentials, keys, personal data or any
  other sensitive content — encoded or not — in issues or reports.
- Reproduce the problem using synthetic data only: a made-up text, a tiny
  generated image, or a hand-built byte sequence, encoded with any Base64 tool.
- You will never be asked to send real data by email or any other channel.

## Scope notes

Base64 Preview decodes Base64 locally and shows the result inside a VS Code
webview. It makes no network requests and stores nothing; decoded content is
held in memory only while the panel is open. When one of its commands is run
it reads the clipboard once, uses the text only if it has the shape of Base64
or a `data:` URI, and writes to the clipboard only when a copy button is
pressed.

The webview has no access to local files or to the network. Images are
rendered from `data:` URIs built in memory, and SVG is shown through an `<img>`
element, so scripts inside an SVG do not run. Text is inserted as text, never
as markup. Files are written only through the save dialog, to the location you
choose there.

File-type detection is a reading aid: it names what the bytes look like so you
can pick a suitable application, and it does not make the content safe. A
decoded file should be treated with the same care as any file downloaded from
the source the Base64 came from. Reports that the panel renders content as
markup, runs script from decoded data, reaches the network, or writes a file
anywhere other than the chosen location are in scope and welcome; reports that
a decoded file is itself malicious are not.
