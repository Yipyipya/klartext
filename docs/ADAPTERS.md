# Provider adapter guide

Nivune keeps transcription and optional text refinement as separate stages.
An adapter must implement one stage without silently changing the other one.
The shared contracts live in `shared/`; web and desktop supply platform-specific
storage, audio, networking, and credential adapters around them.

## Required behavior

- Declare provider location, supported formats, size limits, languages, context,
  timestamps, and model-list capability accurately.
- Capture the selected provider, model, language, context, and dictionary when a
  job starts. Later settings changes must not mutate a running job.
- Reject incomplete profiles before recording or uploading.
- Never fall back to another provider after an error.
- Keep credentials outside exported settings and renderer snapshots.
- Do not forward authorization headers across redirects. Remote custom endpoints
  require HTTPS; plain HTTP is limited to explicit loopback development paths.
- Map authentication, rate-limit, cancellation, malformed response, and empty
  response failures to understandable errors without logging private content.
- Preserve raw transcripts. Refinement failure must leave the raw result usable.

## Adding a transcription adapter

1. Add or extend the provider capability and profile contracts in `shared/`.
2. Implement request construction and response parsing in the shared cloud
   transcription layer where web and desktop can use the same behavior.
3. Add credential references rather than embedding keys in profiles.
4. Add contract tests for request body, language, model, redirects, cancellation,
   401, 429, invalid JSON, and an empty transcript.
5. Add a local loopback HTTP smoke test. A real third-party request is a separate,
   explicitly authorized release check.
6. Expose the adapter in a UI only after the supported platform path is connected
   and tested. An internal implementation is not a marketed feature.

## Adding a refinement adapter

1. Keep refinement optional and independently selectable.
2. Reuse the conservative prompt and content checks in the shared refinement
   layer instead of creating provider-specific rewriting behavior.
3. Preserve names, numbers, negations, speaker intent, context boundaries, and
   the raw transcript fallback.
4. Cover long-text chunking, adversarial field contents, redirects, cancellation,
   malformed responses, and meaning-changing output in tests.

## Verification

Run the full local chain before opening a pull request:

```bash
npm run verify
```

Tests must remain offline and free by default. Never place real keys or private
audio in fixtures, snapshots, documentation, logs, or issue reports.
