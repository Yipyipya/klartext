# Rights and distribution inventory

Status: source-tree review completed on 22 September 2026. This inventory is a
release check, not a legal opinion.

## Project material

The current Git history identifies one project author account. The application
source, documentation, Resonanz interface, generated application icon, and tray
art are treated as project material and are released under `LICENSE`. The icon is
reproducible from `desktop/make-icon.js`. No font files, stock photos, user voice
recordings, or model weights are stored in the source tree.

The unused Next.js starter SVGs previously under `public/` were removed instead
of being carried into the 1.0 source distribution.

Before the public release, the repository owner must still confirm that they are
authorized to license all project-authored material under MIT and that no private
client code, recordings, or restricted assets were copied into the repository.

## Generated and bundled files

| Files | Origin and treatment |
| --- | --- |
| `desktop/shared-core.cjs`, `desktop/wake-bundle.js` | Generated from project source; regenerate through the documented desktop bundle scripts |
| `desktop/whisper-bundle.js` | Generated bundle containing project integration and Transformers.js runtime code; Apache-2.0 notice applies to the third-party portion |
| `desktop/ort-wasm-*.mjs`, `desktop/ort-wasm-*.wasm` | ONNX Runtime Web distribution; MIT |
| `desktop/rustpotter-*.js`, `desktop/rustpotter-*.wasm` | rustpotter runtime/worklet distributions; Apache-2.0; existing full license retained |
| Electron application framework | Electron MIT plus Chromium, Node.js, and their third-party notices |

`THIRD_PARTY_NOTICES.md` records the direct runtime components. Exact resolved
JavaScript versions and transitive license metadata remain in both lockfiles and
installed package metadata. Release packaging must preserve the project license,
the notice index, and full license texts for directly bundled runtime components.

## Models and services

Whisper model weights are downloaded separately after user action and retain the
license published with the pinned Hugging Face repository revision. They are not
relicensed by Nivune and are not included in native installers.

Provider names identify optional interoperability targets. No provider logo or
provider-owned model is part of the project assets. Users bring their own account
or self-hosted endpoint and remain responsible for the relevant provider terms.

## Name

The source license does not clear the project name. The preliminary search in
`docs/NAME_CLEARANCE.md` was completed on 22 September 2026 and failed for the
working name: two active identical German word marks in class 9 expressly cover
software, and current products already use Klartext for materially similar
dictation workflows. **Klartext is therefore not approved as the public 1.0
name.** The replacement name **Nivune** completed the same preliminary
exact-name register, market, and namespace screen on 22 September 2026 without an
identified same-category exact conflict. This remains a practical pre-release
screen rather than a legal opinion. A trademark filing is not planned or required
for the open-source release.

## Release gate

- [x] MIT license text added to the source tree.
- [x] Direct bundled runtimes and downloaded models identified.
- [x] Unused starter assets removed.
- [x] License and notice files configured as desktop extra resources.
- [ ] Repository owner confirms authority over project material.
- [x] Preliminary Klartext search completed and recorded; outcome requires rename.
- [x] Nivune selected, preliminarily screened, and applied to source/package branding.
- [ ] External repository and web address renamed before public 1.0 links are published.
- [x] Fresh macOS package inspected for all configured notices.
- [ ] Fresh Windows package inspected for all configured notices.
