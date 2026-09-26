# Changelog

All notable changes to Nivune are documented here. Dates use ISO format.
Versions before 1.0 were published under the former working name Klartext.

## [1.0.0-beta.1] - unreleased

First beta under the name Nivune. Full notes (German):
[docs/RELEASE_1.0.0-beta.1.md](docs/RELEASE_1.0.0-beta.1.md).

### Added
- Local Whisper transcription in the desktop app and browser after an explicit,
  visible model download; works offline afterwards.
- Independent choice of transcription (OpenAI, Groq, OpenAI-compatible server,
  local) and text refinement (none, local rules, OpenAI, compatible server, Ollama).
- Desktop workspace: recordings with pause/resume, crash recovery, audio import,
  serial queue, history with raw and edited text, search, TXT/Markdown export.
- Guided four-step setup, complete German and English interface, custom voice
  start phrase.
- Manual update check that only opens the official release page.
- Website in German and English; the web app now lives at `/app`.
- Optional persistent API-key storage in the browser (session storage remains
  the default) and help for browser CORS limits.

### Changed
- Renamed from Klartext to Nivune; existing profiles and voice models stay usable.
- Live dictation stops in a controlled way after ten minutes.
- Hardened Electron configuration (sandbox, ASAR integrity, fuses, narrow IPC).

### Known limitations
- Installers are not yet signed or notarized.
- Windows has not yet been accepted on real hardware.
- Groq has not yet been verified with a real request.

## [0.3.0] - 2026-09-12

Resonanz redesign for web and desktop, published as Klartext.
