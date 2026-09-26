export const TRANSFORMERS_JS_VERSION = "4.3.0";
export const TRANSFORMERS_CACHE_KEY = "transformers-cache";

export type LocalModelChoice = "genau" | "schnell";
export type LocalModelState = "missing" | "partial" | "downloading" | "ready" | "error";
export type LocalModelBackend = "webgpu" | "wasm";

export interface LocalModelDefinition {
  choice: LocalModelChoice;
  id: string;
  revision: string;
  label: string;
  approximateDownloadMb: { wasm: number; webgpu: number };
  license: "Apache-2.0";
  sourceUrl: string;
}

export const LOCAL_MODELS: Record<LocalModelChoice, LocalModelDefinition> = {
  genau: {
    choice: "genau",
    id: "onnx-community/whisper-small",
    revision: "36050c46d777d46dc4b5f43f6d90574fc38f8732",
    label: "Whisper small",
    approximateDownloadMb: { wasm: 260, webgpu: 600 },
    license: "Apache-2.0",
    sourceUrl: "https://huggingface.co/onnx-community/whisper-small",
  },
  schnell: {
    choice: "schnell",
    id: "onnx-community/whisper-base",
    revision: "1846881b6b3a3024392c1eea3ad983695bc23925",
    label: "Whisper base",
    approximateDownloadMb: { wasm: 85, webgpu: 215 },
    license: "Apache-2.0",
    sourceUrl: "https://huggingface.co/onnx-community/whisper-base",
  },
};

export const LOCAL_MODEL_CHOICES = Object.freeze(Object.keys(LOCAL_MODELS) as LocalModelChoice[]);

export function localModelDefinition(choice: LocalModelChoice): LocalModelDefinition {
  return LOCAL_MODELS[choice];
}

export function localModelDefinitionById(id: string): LocalModelDefinition | undefined {
  return LOCAL_MODEL_CHOICES.map((choice) => LOCAL_MODELS[choice]).find((model) => model.id === id);
}

/** Matches current pinned downloads and earlier `main` revision cache entries so
 * removal does not strand model weights from pre-1.0 development builds. */
export function isLocalModelCacheUrl(url: string, model: LocalModelDefinition): boolean {
  const normalized = decodeURIComponent(url).replace(/\\/g, "/");
  return normalized.includes(`/${model.id}/resolve/`)
    || normalized.includes(`/${model.id}/raw/`);
}

export interface LocalModelCacheAdapter {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
  delete(request: string): Promise<boolean>;
}

/** Transformers.js 4.3 keys pinned revisions by their exact Hub URL. Older
 * Nivune builds cached the same immutable responses under `/resolve/main/`.
 * Keep those already-downloaded files usable offline while new downloads use
 * the pinned revision key. */
export async function revisionAwareModelCache(
  model: LocalModelDefinition,
): Promise<LocalModelCacheAdapter | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(TRANSFORMERS_CACHE_KEY);
  const pinnedSegment = `/${model.id}/resolve/${encodeURIComponent(model.revision)}/`;
  const legacySegment = `/${model.id}/resolve/main/`;
  return {
    async match(request) {
      const exact = await cache.match(request);
      if (exact) return exact;
      return request.includes(pinnedSegment)
        ? cache.match(request.replace(pinnedSegment, legacySegment))
        : undefined;
    },
    async put(request, response) {
      await cache.put(request, response);
    },
    delete(request) {
      return cache.delete(request);
    },
  };
}

export function classifyLocalModelCacheFiles(
  urls: string[],
  model: LocalModelDefinition,
  backend?: LocalModelBackend,
): { state: Exclude<LocalModelState, "downloading" | "error">; files: number } {
  const matching = urls.filter((url) => isLocalModelCacheUrl(url, model));
  if (!matching.length) return { state: "missing", files: 0 };
  const names = matching.map((url) => decodeURIComponent(url).toLowerCase());
  const hasConfig = names.some((url) => url.endsWith("/config.json"));
  const hasTokenizer = names.some((url) => url.endsWith("/tokenizer.json"));
  const hasProcessor = names.some((url) => url.endsWith("/preprocessor_config.json"));
  const hasWasmPair = names.some((url) => url.endsWith("/onnx/encoder_model_quantized.onnx"))
    && names.some((url) => url.endsWith("/onnx/decoder_model_merged_quantized.onnx"));
  const hasWebGpuPair = names.some((url) => url.endsWith("/onnx/encoder_model.onnx"))
    && names.some((url) => url.endsWith("/onnx/decoder_model_merged_q4.onnx"));
  const hasBackendFiles = backend === "wasm" ? hasWasmPair : hasWasmPair || hasWebGpuPair;
  return {
    state: hasConfig && hasTokenizer && hasProcessor && hasBackendFiles ? "ready" : "partial",
    files: matching.length,
  };
}
