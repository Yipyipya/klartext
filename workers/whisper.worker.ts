/// <reference lib="webworker" />
import { env, pipeline } from "@huggingface/transformers";
import {
  LOCAL_MODELS,
  TRANSFORMERS_CACHE_KEY,
  classifyLocalModelCacheFiles,
  isLocalModelCacheUrl,
  localModelDefinitionById,
  revisionAwareModelCache,
  type LocalModelDefinition,
} from "../shared/local-models";
import { transcribeInWindows, type WhisperTranscriber } from "../shared/whisper-windows";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULT_MODEL = LOCAL_MODELS.schnell.id;

let transcriber: any = null;
let loadedModelKey = "";
let loading: Promise<any> | null = null;
let loadingModelKey = "";
let activeDownload: { requestId: string; modelKey: string; controller: AbortController } | null = null;

function post(message: Record<string, unknown>) {
  (self as unknown as Worker).postMessage(message);
}

function modelFor(id?: string): LocalModelDefinition {
  return localModelDefinitionById(id || DEFAULT_MODEL) || LOCAL_MODELS.schnell;
}

function modelKey(model: LocalModelDefinition): string {
  return `${model.id}@${model.revision}`;
}

async function releaseTranscriber() {
  const previous = transcriber;
  transcriber = null;
  loadedModelKey = "";
  if (previous?.dispose) await previous.dispose();
}

async function cacheUrls(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(TRANSFORMERS_CACHE_KEY);
  return (await cache.keys()).map((request) => request.url);
}

async function inspectModel(model: LocalModelDefinition) {
  return classifyLocalModelCacheFiles(
    await cacheUrls(),
    model,
    (self as any).navigator?.gpu ? "webgpu" : "wasm",
  );
}

function progressCallback(requestId: string, value: any) {
  if (value.status === "progress_total" || (value.status === "progress" && value.file?.endsWith(".onnx"))) {
    post({
      id: requestId,
      type: "model",
      progress: Math.round(value.progress ?? 0),
      loaded: Number(value.loaded || 0),
      total: Number(value.total || 0),
    });
  }
}

async function createPipeline(
  model: LocalModelDefinition,
  requestId: string,
  controller: AbortController,
  offlineOnly: boolean,
) {
  const previousFetch = env.fetch;
  const previousAllowLocalModels = env.allowLocalModels;
  const previousUseCustomCache = env.useCustomCache;
  const previousCustomCache = env.customCache;
  if (offlineOnly) env.allowLocalModels = true;
  const compatibleCache = offlineOnly ? await revisionAwareModelCache(model) : null;
  if (compatibleCache) {
    env.useCustomCache = true;
    env.customCache = compatibleCache;
  }
  env.fetch = (input: any, init: any = {}) => previousFetch(input, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal,
  });
  try {
    const common = {
      revision: model.revision,
      local_files_only: offlineOnly,
      ...(!offlineOnly ? { progress_callback: (value: any) => progressCallback(requestId, value) } : {}),
    };
    try {
      const hasWebGPU = !!(self as any).navigator?.gpu;
      if (!hasWebGPU) throw new Error("kein WebGPU");
      return await pipeline("automatic-speech-recognition", model.id, {
        ...common,
        device: "webgpu",
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
      });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      // Keep the cache-only environment active until the fallback pipeline has
      // finished loading. Returning the bare promise would run `finally`
      // immediately and restore `env.allowLocalModels=false` too early.
      return await pipeline("automatic-speech-recognition", model.id, {
        ...common,
        device: "wasm",
        dtype: "q8",
      });
    }
  } finally {
    env.fetch = previousFetch;
    env.allowLocalModels = previousAllowLocalModels;
    env.useCustomCache = previousUseCustomCache;
    env.customCache = previousCustomCache;
  }
}

async function getTranscriber(modelId: string | undefined, requestId: string, offlineOnly = false) {
  const model = modelFor(modelId);
  const key = modelKey(model);
  if (transcriber && loadedModelKey === key) return transcriber;

  if (loading && loadingModelKey !== key) {
    activeDownload?.controller.abort();
    await loading.catch(() => {});
  }
  if (transcriber && loadedModelKey !== key) await releaseTranscriber();
  if (loading && loadingModelKey === key) return loading;

  const controller = new AbortController();
  activeDownload = { requestId, modelKey: key, controller };
  loadingModelKey = key;
  loading = createPipeline(model, requestId, controller, offlineOnly)
    .then((created) => {
      transcriber = created;
      loadedModelKey = key;
      return created;
    })
    .finally(() => {
      loading = null;
      loadingModelKey = "";
      if (activeDownload?.controller === controller) activeDownload = null;
    });
  return loading;
}

async function removeModel(model: LocalModelDefinition) {
  const key = modelKey(model);
  if (activeDownload?.modelKey === key) activeDownload.controller.abort();
  if (loadingModelKey === key) await loading?.catch(() => {});
  if (loadedModelKey === key) await releaseTranscriber();
  if (typeof caches === "undefined") return { state: "missing" as const, files: 0 };
  const cache = await caches.open(TRANSFORMERS_CACHE_KEY);
  const requests = await cache.keys();
  await Promise.all(requests
    .filter((request) => isLocalModelCacheUrl(request.url, model))
    .map((request) => cache.delete(request)));
  return inspectModel(model);
}

self.onmessage = async (event: MessageEvent) => {
  const request = event.data as {
    type?: "transcribe" | "inspect-model" | "prepare-model" | "remove-model" | "cancel-model";
    id: string;
    targetId?: string;
    audio?: Float32Array;
    language?: string | null;
    model?: string;
  };
  const type = request.type || "transcribe";
  const model = modelFor(request.model);

  if (type === "cancel-model") {
    if (!request.targetId || activeDownload?.requestId === request.targetId) activeDownload?.controller.abort();
    return;
  }

  try {
    if (type === "inspect-model") {
      post({ id: request.id, type: "model-status", model: model.id, ...(await inspectModel(model)) });
      return;
    }
    if (type === "remove-model") {
      post({ id: request.id, type: "model-removed", model: model.id, ...(await removeModel(model)) });
      return;
    }
    if (type === "prepare-model") {
      await getTranscriber(model.id, request.id, false);
      post({ id: request.id, type: "model-ready", model: model.id, ...(await inspectModel(model)) });
      return;
    }

    const audio = request.audio;
    if (!audio) throw new Error("LOCAL_AUDIO_MISSING");
    if (!(transcriber && loadedModelKey === modelKey(model))) {
      const cached = await inspectModel(model);
      if (cached.state !== "ready") throw new Error("LOCAL_MODEL_NOT_READY");
    }
    const activeTranscriber = await getTranscriber(model.id, request.id, true);
    post({ id: request.id, type: "status", status: "transkribiert" });
    const text = await transcribeInWindows(activeTranscriber as unknown as WhisperTranscriber, audio, 16000, {
      language: request.language || undefined,
    });
    post({ id: request.id, type: "result", text });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    const cancelled = error?.name === "AbortError" || message.includes("aborted");
    post({
      id: request.id,
      type: type === "transcribe" ? "error" : "model-error",
      code: message === "LOCAL_MODEL_NOT_READY"
        ? "LOCAL_MODEL_NOT_READY"
        : cancelled ? "MODEL_DOWNLOAD_ABORTED" : "MODEL_OPERATION_FAILED",
      message,
    });
  }
};
