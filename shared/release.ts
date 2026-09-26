// Zentrale Release-Ziele. Die externe Umbenennung des Repositorys und der
// Webadresse ist eine offene Entscheidung des Projektinhabers; bis dahin zeigen
// alle Links auf das bestehende Repository. Beim Umzug nur diese Werte ändern.
export const RELEASE_REPOSITORY = "Yipyipya/klartext";
export const RELEASE_REPOSITORY_URL = `https://github.com/${RELEASE_REPOSITORY}`;
export const RELEASES_PAGE_URL = `${RELEASE_REPOSITORY_URL}/releases`;
export const LATEST_DOWNLOAD_BASE_URL = `${RELEASES_PAGE_URL}/latest/download`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
export const WEB_APP_URL = "https://klartext-ai.vercel.app/app";

export const RELEASE_ASSETS = {
  mac: "Nivune-Mac-AppleSilicon.dmg",
  windows: "Nivune-Windows.exe",
  checksums: "SHA256SUMS.txt",
} as const;

const MAX_NOTES_LENGTH = 4000;
const UPDATE_TIMEOUT_MS = 10_000;

interface ParsedVersion {
  core: [number, number, number];
  prerelease: Array<number | string>;
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:-([0-9A-Za-z.-]{1,64}))?(?:\+[0-9A-Za-z.-]{1,64})?$/.exec(String(value || "").trim());
  if (!match) return null;
  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease };
}

/** Vergleicht zwei SemVer-Angaben. Ungültige Werte gelten als nicht vergleichbar (null). */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;
    if (typeof l === "number" && typeof r === "number") return l > r ? 1 : -1;
    if (typeof l === "number") return -1;
    if (typeof r === "number") return 1;
    return l > r ? 1 : -1;
  }
  return 0;
}

export interface ReleaseInfo {
  version: string;
  url: string;
  notes: string;
  publishedAt: string | null;
}

export type UpdateCheckResult =
  | { state: "current"; currentVersion: string; latest: ReleaseInfo }
  | { state: "available"; currentVersion: string; latest: ReleaseInfo }
  | { state: "error"; currentVersion: string; error: string };

/** Nur Release-Seiten des festgelegten Repositorys dürfen geöffnet werden. */
export function isOfficialReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && !url.username && !url.password && !url.port
      && url.pathname.startsWith(`/${RELEASE_REPOSITORY}/releases/`);
  } catch {
    return false;
  }
}

export function parseLatestRelease(payload: unknown): ReleaseInfo {
  if (!payload || typeof payload !== "object") throw new Error("RELEASE_INVALID_RESPONSE");
  const data = payload as Record<string, unknown>;
  if (data.draft === true || data.prerelease === true) throw new Error("RELEASE_NOT_STABLE");
  const tag = typeof data.tag_name === "string" ? data.tag_name.trim() : "";
  const version = tag.replace(/^v/, "");
  if (!parseVersion(version)) throw new Error("RELEASE_INVALID_VERSION");
  const url = typeof data.html_url === "string" ? data.html_url : "";
  if (!isOfficialReleaseUrl(url)) throw new Error("RELEASE_UNTRUSTED_URL");
  const notes = typeof data.body === "string" ? data.body.replace(/\r\n/g, "\n").trim().slice(0, MAX_NOTES_LENGTH) : "";
  const publishedAt = typeof data.published_at === "string" && !Number.isNaN(Date.parse(data.published_at))
    ? data.published_at
    : null;
  return { version, url, notes, publishedAt };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Fragt ausschließlich auf ausdrücklichen Nutzerbefehl die neueste stabile
 * Veröffentlichung ab. Es wird nichts heruntergeladen oder installiert.
 */
export async function checkForUpdate(options: {
  currentVersion: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<UpdateCheckResult> {
  const currentVersion = String(options.currentVersion || "");
  const fetcher = options.fetch || (globalThis.fetch as FetchLike | undefined);
  if (!fetcher) return { state: "error", currentVersion, error: "UPDATE_FETCH_UNAVAILABLE" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? UPDATE_TIMEOUT_MS);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetcher(LATEST_RELEASE_API_URL, {
      method: "GET",
      headers: { Accept: "application/vnd.github+json" },
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 404) return { state: "error", currentVersion, error: "UPDATE_NO_RELEASE" };
    if (response.status === 403 || response.status === 429) return { state: "error", currentVersion, error: "UPDATE_RATE_LIMITED" };
    if (!response.ok) return { state: "error", currentVersion, error: `UPDATE_HTTP_${response.status}` };
    const latest = parseLatestRelease(await response.json());
    const comparison = compareVersions(latest.version, currentVersion);
    if (comparison === null) return { state: "error", currentVersion, error: "UPDATE_VERSION_UNCOMPARABLE" };
    return comparison > 0
      ? { state: "available", currentVersion, latest }
      : { state: "current", currentVersion, latest };
  } catch (error) {
    const code = controller.signal.aborted
      ? "UPDATE_TIMEOUT"
      : error instanceof Error && /^RELEASE_/.test(error.message) ? error.message : "UPDATE_NETWORK";
    return { state: "error", currentVersion, error: code };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
