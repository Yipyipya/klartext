# Contributing to Nivune

Thanks for helping improve Nivune. Small, focused changes with a clear user
benefit are easiest to review.

## Before opening a change

- Search existing issues and pull requests.
- Open a feature proposal before implementing a large UI, provider, storage, or
  architecture change.
- Never include API keys, private transcripts, recordings, local profiles, or
  generated model caches.
- Keep local and cloud processing visibly distinct. A failure must never trigger
  a silent provider switch.

## Development

Use Node.js 24 and install both dependency trees:

```bash
npm ci
npm --prefix desktop ci
npm run verify
```

The complete build instructions and platform limitations are in
[`docs/BUILDING.md`](docs/BUILDING.md). Provider architecture and extension
rules are documented in [`docs/ADAPTERS.md`](docs/ADAPTERS.md).

Add regression tests for behavioral changes. Do not make paid API calls in the
default test suite. Changes to UI behavior should be checked with keyboard and
screen-reader semantics in addition to visual appearance.

## Pull requests

A pull request should explain:

- the problem and the intended behavior;
- the affected local, cloud, web, and desktop paths;
- the verification performed;
- any remaining platform or provider limitation.

By submitting a contribution, you agree that it is provided under the project's
[MIT License](LICENSE) and that you have the right to submit it. Third-party code,
assets, recordings, and generated media must include their origin and applicable
license.
