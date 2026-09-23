# Changelog

All notable, user-visible changes to Base64 Preview are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-23

### Added

- Local decoding of Base64 text, `data:` URIs, the URL-safe alphabet,
  line-wrapped and quoted input, and input with missing padding, with a plain
  explanation when the text is not Base64.
- Detection of what the decoded bytes are: images (PNG, JPEG, GIF, WebP, SVG,
  BMP, ICO, AVIF), documents (PDF, DOCX, XLSX, PPTX, legacy Office), archives
  (ZIP, JAR, GZIP, BZIP2, XZ, 7z, RAR, TAR), audio and video (MP3, WAV, OGG,
  FLAC, MP4, M4A, WebM, AVI), fonts (WOFF, WOFF2, TTF, OTF), executables and
  databases, plus UTF-8 / UTF-16 text classified as JSON, XML, SVG, HTML, PEM,
  RTF or a JWT.
- Inline preview: images rendered in the panel, JSON as a collapsible tree with
  a copy button, text as text, and a hex dump for everything, switchable with a
  Preview / Hex toggle.
- **Save as file…** writes the decoded bytes to a location you pick, with a
  suggested name and extension matching the detected type.
- **Open in editor** and **Copy text** for decoded text.
- Both commands pick up Base64 from the clipboard. **Base64: Open Preview**
  decodes the clipboard when it holds something shaped like Base64 or a `data:`
  URI, and **Base64: Decode Selection** does the same when nothing is selected
  in the editor.
- Strict webview isolation: no network access, no local resource access,
  images rendered only from in-memory `data:` URIs, nothing stored.
