export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export function normalizeOllamaBaseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function requireLocalOllamaBaseUrl(value: string): string {
  const normalized = normalizeOllamaBaseUrl(value);
  if (!normalized) throw new Error("OLLAMA_ENDPOINT_NOT_LOCAL");
  return normalized;
}
