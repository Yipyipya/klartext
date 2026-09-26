export type ProcessingLocation = "device" | "provider";

export interface TranscriptionCapabilities {
  provider: string;
  processingLocation: ProcessingLocation;
  acceptedAudio: readonly string[];
  maxAudioBytes: number | null;
  languages: "model-dependent" | readonly string[];
  supportsContext: boolean;
  supportsTimestamps: boolean;
  supportsModelList: boolean;
}

export interface RefinementCapabilities {
  provider: string;
  processingLocation: ProcessingLocation;
  supportsContext: boolean;
  supportsModelList: boolean;
}

/** The core receives decoded 16-kHz mono PCM. Container support belongs to the
 * browser or desktop adapter and must be reported separately by that adapter. */
export const LOCAL_WHISPER_CAPABILITIES: TranscriptionCapabilities = {
  provider: "local",
  processingLocation: "device",
  acceptedAudio: ["audio/pcm;rate=16000;channels=1"],
  maxAudioBytes: null,
  languages: "model-dependent",
  supportsContext: false,
  supportsTimestamps: false,
  supportsModelList: false,
};

export const OPENAI_TRANSCRIPTION_CAPABILITIES: TranscriptionCapabilities = {
  provider: "openai",
  processingLocation: "provider",
  acceptedAudio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm"],
  maxAudioBytes: 24_000_000,
  languages: "model-dependent",
  supportsContext: true,
  supportsTimestamps: false,
  supportsModelList: false,
};

export const GROQ_TRANSCRIPTION_CAPABILITIES: TranscriptionCapabilities = {
  provider: "groq",
  processingLocation: "provider",
  acceptedAudio: ["audio/flac", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"],
  maxAudioBytes: 24_000_000,
  languages: "model-dependent",
  supportsContext: true,
  supportsTimestamps: true,
  supportsModelList: true,
};

export const DEEPGRAM_TRANSCRIPTION_CAPABILITIES: TranscriptionCapabilities = {
  provider: "deepgram",
  processingLocation: "provider",
  acceptedAudio: ["audio/aac", "audio/flac", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"],
  maxAudioBytes: 2_000_000_000,
  languages: "model-dependent",
  supportsContext: false,
  supportsTimestamps: true,
  supportsModelList: false,
};

export const COMPATIBLE_TRANSCRIPTION_CAPABILITIES: TranscriptionCapabilities = {
  provider: "openai-compatible",
  processingLocation: "provider",
  acceptedAudio: ["provider-dependent"],
  maxAudioBytes: null,
  languages: "model-dependent",
  supportsContext: true,
  supportsTimestamps: false,
  supportsModelList: false,
};

export const OPENAI_REFINEMENT_CAPABILITIES: RefinementCapabilities = {
  provider: "openai",
  processingLocation: "provider",
  supportsContext: true,
  supportsModelList: false,
};

export const OLLAMA_REFINEMENT_CAPABILITIES: RefinementCapabilities = {
  provider: "ollama",
  processingLocation: "device",
  supportsContext: true,
  supportsModelList: true,
};

export const COMPATIBLE_REFINEMENT_CAPABILITIES: RefinementCapabilities = {
  provider: "openai-compatible",
  processingLocation: "provider",
  supportsContext: true,
  supportsModelList: false,
};
