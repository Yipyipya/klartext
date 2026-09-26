import {
  applyDictionary,
  cleanTranscript as cleanSharedTranscript,
} from "../shared/processing";
import type { Settings } from "./store";

export { applyDictionary };

export function cleanTranscript(text: string, settings: Settings): string {
  return cleanSharedTranscript(text, {
    cleanupLevel: settings.cleanup,
    language: settings.lang,
    dictionary: settings.dictionary,
  });
}
