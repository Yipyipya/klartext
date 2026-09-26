import type {
  CleanupLevel,
  DictionaryEntry,
  RefinementProfile,
  TranscriptionProfile,
} from "./settings";

export type ProcessingStage = "transcribing" | "refining" | "postprocessing";

export interface ProcessingPlan {
  transcription: TranscriptionProfile;
  refinement: RefinementProfile;
  language: string;
  context: string;
  dictionary: DictionaryEntry[];
  cleanupLevel: CleanupLevel;
}

export interface ProcessingJob<Audio = unknown> {
  audio?: Audio;
  rawText?: string;
  plan: ProcessingPlan;
}

export interface ProcessingDependencies<Audio = unknown> {
  transcribe: (audio: Audio, profile: TranscriptionProfile, plan: ProcessingPlan) => Promise<string>;
  refine?: (text: string, profile: RefinementProfile, plan: ProcessingPlan) => Promise<string>;
}

export interface ProcessingResult {
  rawText: string;
  text: string;
  warning?: "refinement_failed";
}

const FILLER_DE =
  /(^|[\s,„("'-])(?:ähm+|ähh+|äh+|ehm+|öhm+|hmm+|mhm+)(?=[\s.,!?:;…)"'-]|$)/gi;
const FILLER_EN =
  /(^|[\s,("'-])(?:um+|uh+|uhm+|erm+|hmm+|mhm+)(?=[\s.,!?:;…)"'-]|$)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyDictionary(text: string, dictionary: DictionaryEntry[]): string {
  let result = text;
  for (const { from, to } of dictionary) {
    if (!from.trim()) continue;
    result = result.replace(
      new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(from.trim())}(?![\\p{L}\\p{N}_])`, "giu"),
      () => to,
    );
  }
  return result;
}

export function cleanTranscript(
  text: string,
  options: { cleanupLevel: CleanupLevel; language: string; dictionary: DictionaryEntry[] },
): string {
  let result = text;
  if (options.cleanupLevel !== "aus") {
    result = result.replace(options.language.startsWith("de") ? FILLER_DE : FILLER_EN, "$1");
  }
  if (options.cleanupLevel === "stark") {
    result = result.replace(/(^|\s)(\p{L}{2,})(?:\s+\2)+(?=\s|[.,!?]|$)/giu, "$1$2");
  }
  result = result
    .replace(/\s+([,.!?;:…])/g, "$1")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (options.cleanupLevel !== "aus" && result) {
    result = result.replace(/(^|[.!?…]\s+)(\p{Ll})/gu, (_match, prefix: string, character: string) => prefix + character.toUpperCase());
  }
  if (options.cleanupLevel === "stark" && result && !/[.!?…"')\]]$/.test(result)) result += ".";
  return applyDictionary(result, options.dictionary);
}

const PERSONAL_PRONOUNS = new Set([
  "ich", "du", "er", "sie", "es", "wir", "ihr", "mich", "dich", "mir", "dir", "uns", "euch",
  "mein", "meine", "meinen", "dein", "deine", "deinen", "unser", "unsere",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "our", "their",
]);
const NEGATIONS = new Set(["nicht", "kein", "keine", "keinen", "keinem", "keiner", "not", "no", "never", "neither"]);
const FILLER_WORDS = new Set(["äh", "ähm", "ähh", "ehm", "öhm", "hmm", "mhm", "um", "uh", "uhm", "erm"]);

function tokens(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function containsCounts(source: string[], output: string[], selected: Set<string>): boolean {
  const remaining = new Map<string, number>();
  for (const token of output) remaining.set(token, (remaining.get(token) || 0) + 1);
  for (const token of source) {
    if (!selected.has(token)) continue;
    const count = remaining.get(token) || 0;
    if (!count) return false;
    remaining.set(token, count - 1);
  }
  return true;
}

/** Conservative semantic tripwire. It cannot prove equivalence, but rejects
 * common destructive refinements before they replace a complete transcript. */
export function isRefinementSafe(input: string, output: string, dictionary: DictionaryEntry[]): boolean {
  const source = tokens(applyDictionary(input, dictionary)).filter((token) => !FILLER_WORDS.has(token));
  const target = tokens(output).filter((token) => !FILLER_WORDS.has(token));
  if (!source.length || !target.length) return false;
  const lengthRatio = output.trim().length / Math.max(1, input.trim().length);
  if (lengthRatio < 0.4 || lengthRatio > 1.8) return false;
  if (!containsCounts(source, target, PERSONAL_PRONOUNS)) return false;
  if (!containsCounts(source, target, NEGATIONS)) return false;
  const remaining = new Map<string, number>();
  for (const token of target) remaining.set(token, (remaining.get(token) || 0) + 1);
  let retained = 0;
  for (const token of source) {
    const count = remaining.get(token) || 0;
    if (!count) continue;
    retained++;
    remaining.set(token, count - 1);
  }
  return retained / source.length >= 0.5;
}

export async function runProcessingJob<Audio>(
  job: ProcessingJob<Audio>,
  dependencies: ProcessingDependencies<Audio>,
  onStage: (stage: ProcessingStage) => void = () => {},
): Promise<ProcessingResult> {
  let rawText = job.rawText;
  if (rawText === undefined) {
    if (job.audio === undefined) throw new Error("PROCESSING_AUDIO_MISSING");
    onStage("transcribing");
    rawText = await dependencies.transcribe(job.audio, job.plan.transcription, job.plan);
  }
  rawText = rawText.trim();
  if (!rawText) throw new Error("PROCESSING_TRANSCRIPTION_EMPTY");

  let text = rawText;
  let warning: ProcessingResult["warning"];
  if (job.plan.refinement.provider !== "none" && job.plan.refinement.provider !== "deterministic") {
    onStage("refining");
    try {
      if (!dependencies.refine) throw new Error("PROCESSING_REFINER_MISSING");
      const refined = (await dependencies.refine(rawText, job.plan.refinement, job.plan)).trim();
      if (!refined) throw new Error("PROCESSING_REFINEMENT_EMPTY");
      if (!isRefinementSafe(rawText, refined, job.plan.dictionary)) throw new Error("PROCESSING_REFINEMENT_UNSAFE");
      text = refined;
    } catch {
      text = rawText;
      warning = "refinement_failed";
    }
  }
  onStage("postprocessing");
  return {
    rawText,
    text: cleanTranscript(text, {
      cleanupLevel: job.plan.cleanupLevel,
      language: job.plan.language,
      dictionary: job.plan.dictionary,
    }),
    warning,
  };
}
