import { normalizeCompatibleBaseUrl } from "./cloud-transcription-providers";

export const OPENAI_CREDENTIAL_REF = "provider:openai:default";
export const GROQ_CREDENTIAL_REF = "provider:groq:default";
const MAX_CREDENTIAL_LENGTH = 16_384;

export type CompatibleCredentialPurpose = "transcription" | "refinement";

export function compatibleCredentialRef(
  purpose: CompatibleCredentialPurpose,
  baseUrl: string,
): string | null {
  const normalized = normalizeCompatibleBaseUrl(baseUrl);
  return normalized
    ? `provider:openai-compatible:${purpose}:${encodeURIComponent(normalized)}`
    : null;
}

export function isCredentialRef(value: string): boolean {
  if (value === OPENAI_CREDENTIAL_REF || value === GROQ_CREDENTIAL_REF) return true;
  const match = /^provider:openai-compatible:(transcription|refinement):(.+)$/.exec(value);
  if (!match) return false;
  try {
    const decoded = decodeURIComponent(match[2]);
    return compatibleCredentialRef(match[1] as CompatibleCredentialPurpose, decoded) === value;
  } catch {
    return false;
  }
}

/** Credentials are always stored outside settings. Unknown references, non-string
 * values and implausibly large values are discarded instead of entering runtime. */
export function sanitizeCredentialRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [ref, secret] of Object.entries(value).slice(0, 100)) {
    if (!isCredentialRef(ref) || typeof secret !== "string") continue;
    const normalized = secret.trim();
    if (!normalized || normalized.length > MAX_CREDENTIAL_LENGTH) continue;
    result[ref] = normalized;
  }
  return result;
}
