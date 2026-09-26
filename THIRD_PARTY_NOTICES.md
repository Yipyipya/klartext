# Third-party notices

Nivune is licensed under the MIT License. It includes and uses third-party
software and optionally downloads separately licensed model weights. Those
components remain subject to their own licenses.

The exact dependency graph used for a build is recorded in `package-lock.json`
and `desktop/package-lock.json`. The desktop package contains the project
license, this notice, and the license texts for the runtime components that are
bundled directly into the application.

## Runtime components distributed with Nivune

| Component | Version in this source tree | License | Upstream |
| --- | --- | --- | --- |
| Next.js | 16.3.5 | MIT | <https://github.com/vercel/next.js> |
| React and React DOM | 19.2.4 | MIT | <https://github.com/facebook/react> |
| Transformers.js | 4.3.0 | Apache-2.0 | <https://github.com/huggingface/transformers.js> |
| ONNX Runtime Web | 1.31.0-dev.20260914-8d85527a0 | MIT | <https://github.com/microsoft/onnxruntime> |
| Electron | 43.1.0 | MIT; Electron includes Chromium, Node.js, and other third-party software under their respective licenses | <https://github.com/electron/electron> |
| rustpotter-web | 3.0.2 | Apache-2.0 | <https://github.com/GiviMAD/rustpotter-wasm> |
| rustpotter-worklet | 3.0.3 | Apache-2.0 | <https://github.com/GiviMAD/rustpotter-worklet> |

Build-only packages are not part of Nivune's source license. Their license
metadata and resolved versions are retained in the lockfiles and installed
package metadata.

## Models downloaded by the user

Nivune does not place model weights under the Nivune MIT License. The model
manager downloads a selected model only after an explicit user action.

| Model | Pinned revision | Declared license | Source |
| --- | --- | --- | --- |
| ONNX Community Whisper Small | `36050c46d777d46dc4b5f43f6d90574fc38f8732` | Apache-2.0 | <https://huggingface.co/onnx-community/whisper-small> |
| ONNX Community Whisper Base | `1846881b6b3a3024392c1eea3ad983695bc23925` | Apache-2.0 | <https://huggingface.co/onnx-community/whisper-base> |

See `docs/LOCAL_MODELS.md` for distribution, download, and cache details.

## Service providers

OpenAI, Groq, Ollama, and compatible endpoints are optional external services,
not parts of Nivune. Their names identify interoperability targets and do not
imply endorsement. Users are responsible for the terms and costs of services
they choose.
