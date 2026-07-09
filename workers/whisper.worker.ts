/// <reference lib="webworker" />
import { pipeline } from "@huggingface/transformers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODEL = "onnx-community/whisper-base";

let transcriber: any = null;
let loading: Promise<any> | null = null;

function post(msg: Record<string, unknown>) {
  (self as unknown as Worker).postMessage(msg);
}

async function getTranscriber() {
  if (transcriber) return transcriber;
  if (!loading) {
    loading = (async () => {
      const progress_callback = (p: any) => {
        if (p.status === "progress" && p.file?.endsWith(".onnx")) {
          post({
            type: "model",
            file: p.file,
            progress: Math.round(p.progress ?? 0),
          });
        }
      };
      // WebGPU zuerst, sonst WASM-Fallback
      try {
        const hasWebGPU = !!(self as any).navigator?.gpu;
        if (!hasWebGPU) throw new Error("kein WebGPU");
        transcriber = await pipeline("automatic-speech-recognition", MODEL, {
          device: "webgpu",
          dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
          progress_callback,
        });
      } catch {
        transcriber = await pipeline("automatic-speech-recognition", MODEL, {
          device: "wasm",
          dtype: "q8",
          progress_callback,
        });
      }
      return transcriber;
    })();
  }
  return loading;
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, audio, language } = ev.data as {
    id: string;
    audio: Float32Array;
    language: string | null;
  };
  try {
    const t = await getTranscriber();
    post({ id, type: "status", status: "transkribiert" });
    const out = await t(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: language || undefined,
      task: "transcribe",
    });
    const text = Array.isArray(out)
      ? out.map((o: any) => o.text).join(" ")
      : out.text;
    post({ id, type: "result", text: (text ?? "").trim() });
  } catch (err: any) {
    post({ id, type: "error", message: String(err?.message ?? err) });
  }
};
