# Nivune

**Speak. The rest is text.**

[Deutsch](README.de.md)

Nivune is a free, local-first dictation and transcription application for the
web, macOS, and Windows. It works without a Nivune account and lets users choose
where audio and text are processed: on the device, by a supported provider using
their own credentials, or by a compatible self-hosted endpoint.

## Project status

The last public release is **0.3.0 under the former working name Klartext**. The
`develop/v1-core` branch contains the unreleased Nivune 1.0 work and must not
be presented as a stable public release. The
verified implementation status and remaining platform gates are documented in
[`docs/FEATURE_STATUS.md`](docs/FEATURE_STATUS.md).

The 1.0 development version includes:

- system-wide desktop dictation with clipboard and cursor insertion;
- microphone recordings and audio-file imports;
- local Whisper transcription with explicit model downloads;
- OpenAI, Groq, and compatible transcription endpoints with user-owned keys;
- optional deterministic cleanup, OpenAI-compatible refinement, or local Ollama;
- editable raw and refined text, local history, TXT/Markdown export, and recovery;
- separate interface and spoken-language settings in German and English;
- a manual update check that only opens the official release page;
- no Nivune account, mandatory subscription, hidden proxy, or silent cloud fallback.

Some of these paths are not yet released or fully accepted on Windows. Do not use
the development build for irreplaceable recordings.

## Development

Node.js 24 is the supported build runtime.

```bash
npm ci
npm --prefix desktop ci
npm run verify
```

Run the web application locally:

```bash
npm run dev
```

The public website is served at `/` (German) and `/en`; the web application
lives at `/app`.

Run the Electron application:

```bash
npm --prefix desktop start
```

The full source-build and packaging instructions are in
[`docs/BUILDING.md`](docs/BUILDING.md). Self-hosting and data-flow boundaries are
documented in [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Local models and external providers

Model weights are not included in the source tree or installer. Nivune downloads
a selected model only after an explicit user action and then uses its pinned cache
revision. See [`docs/LOCAL_MODELS.md`](docs/LOCAL_MODELS.md) for model versions,
licenses, sizes, and verified offline boundaries.

External providers are optional and may charge for their APIs. Credentials are
entered for the selected target; Nivune does not provide a shared transcription
backend. Local processing and cloud processing are shown separately in the app.

## Contributing and security

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before proposing a change. Provider
extensions must follow [`docs/ADAPTERS.md`](docs/ADAPTERS.md). Report suspected
vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md); never post
keys, private transcripts, recordings, or exploit details in a public issue.

## License

Nivune source code is available under the [MIT License](LICENSE). Dependencies,
bundled runtimes, and separately downloaded models retain their own licenses; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
