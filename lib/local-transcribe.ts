import { decodeAudio } from "./audio-upload";
import {
  transcribeLocalAudioWith,
  type LocalAudioOptions,
  type LocalProgress,
} from "./local-audio";
import { translate } from "../shared/i18n";
import type { LocalModelState } from "../shared/local-models";

export type LocalTranscriptionOptions = LocalAudioOptions;

export interface LocalModelStatus {
  model: string;
  state: Exclude<LocalModelState, "downloading" | "error">;
  files: number;
}

export interface LocalModelProgress {
  progress: number;
  loaded: number;
  total: number;
}

type PendingRequest = {
  kind: "transcription" | "model";
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  progress: LocalProgress;
  options: LocalTranscriptionOptions;
  modelProgress?: (progress: LocalModelProgress) => void;
};

let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();

function stopWorker(errorFor: (request: PendingRequest) => Error) {
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) request.reject(errorFor(request));
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    const interfaceLanguage = request.options.interfaceLanguage ?? "de";
    if (message.type === "model") {
      const progress = Number(message.progress || 0);
      request.progress({ type: "model", detail: translate(interfaceLanguage, "processing.localModelLoading", { progress }) });
      request.modelProgress?.({
        progress,
        loaded: Number(message.loaded || 0),
        total: Number(message.total || 0),
      });
    } else if (message.type === "status") {
      request.progress({ type: "status", detail: translate(interfaceLanguage, "processing.localTranscribing") });
    } else if (message.type === "result") {
      pending.delete(message.id);
      request.resolve(String(message.text || "").trim());
    } else if (["model-status", "model-ready", "model-removed"].includes(message.type)) {
      pending.delete(message.id);
      request.resolve({
        model: String(message.model || request.options.model),
        state: message.state,
        files: Number(message.files || 0),
      } satisfies LocalModelStatus);
    } else if (message.type === "error" || message.type === "model-error") {
      pending.delete(message.id);
      const code = String(message.code || "LOCAL_TRANSCRIPTION_FAILED");
      const error = new Error(code === "LOCAL_MODEL_NOT_READY"
        ? translate(interfaceLanguage, "error.local.modelNotReady")
        : String(message.message || "Lokale Transkription fehlgeschlagen."));
      error.name = code;
      request.reject(error);
    }
  });
  worker.addEventListener("error", () => stopWorker((request) => new Error(
    translate(request.options.interfaceLanguage ?? "de", "error.local.workerStopped"),
  )));
  return worker;
}

async function transcribePcm(
  pcm: Float32Array,
  options: LocalTranscriptionOptions,
  progress: LocalProgress,
): Promise<string> {
  options.signal?.throwIfAborted();
  const id = crypto.randomUUID();
  const activeWorker = getWorker();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(translate(options.interfaceLanguage ?? "de", "error.local.timeout")));
    }, 20 * 60 * 1000);
    const finish = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      stopWorker((request) => new Error(
        translate(request.options.interfaceLanguage ?? "de", "error.local.aborted"),
      ));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    pending.set(id, {
      kind: "transcription",
      resolve: (text) => { finish(); resolve(String(text)); },
      reject: (error) => { finish(); reject(error); },
      progress,
      options,
    });
    activeWorker.postMessage({ type: "transcribe", id, audio: pcm, language: options.language, model: options.model }, [pcm.buffer]);
  });
}

export function transcribeLocalPcm(
  pcm: Float32Array,
  options: LocalTranscriptionOptions,
  progress: LocalProgress = () => {},
): Promise<string> {
  return transcribePcm(pcm, options, progress);
}

function runModelOperation(
  type: "inspect-model" | "prepare-model" | "remove-model",
  model: string,
  onProgress: (progress: LocalModelProgress) => void = () => {},
  signal?: AbortSignal,
): Promise<LocalModelStatus> {
  signal?.throwIfAborted();
  const id = crypto.randomUUID();
  const activeWorker = getWorker();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      activeWorker.postMessage({ type: "cancel-model", id: crypto.randomUUID(), targetId: id });
      pending.delete(id);
      finish();
      reject(new Error("MODEL_OPERATION_TIMEOUT"));
    }, type === "prepare-model" ? 30 * 60 * 1000 : 30_000);
    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      activeWorker.postMessage({ type: "cancel-model", id: crypto.randomUUID(), targetId: id });
      pending.delete(id);
      finish();
      const error = new Error("MODEL_DOWNLOAD_ABORTED");
      error.name = "AbortError";
      reject(error);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    pending.set(id, {
      kind: "model",
      resolve: (status) => { finish(); resolve(status as LocalModelStatus); },
      reject: (error) => { finish(); reject(error); },
      progress: () => {},
      modelProgress: onProgress,
      options: { language: null, model },
    });
    activeWorker.postMessage({ type, id, model });
  });
}

export function inspectLocalModel(model: string): Promise<LocalModelStatus> {
  return runModelOperation("inspect-model", model);
}

export function prepareLocalModel(
  model: string,
  onProgress?: (progress: LocalModelProgress) => void,
  signal?: AbortSignal,
): Promise<LocalModelStatus> {
  return runModelOperation("prepare-model", model, onProgress, signal);
}

export function removeLocalModel(model: string): Promise<LocalModelStatus> {
  return runModelOperation("remove-model", model);
}

export async function transcribeLocally(
  audio: Blob,
  options: LocalTranscriptionOptions,
  progress: LocalProgress = () => {},
  dependencies = { decode: decodeAudio, transcribePcm },
): Promise<string> {
  return transcribeLocalAudioWith(audio, options, progress, dependencies);
}
