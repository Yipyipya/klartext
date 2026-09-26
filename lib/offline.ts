export const OFFLINE_SHELL_CACHE = "nivune-shell-v2";

export type OfflineShellState = "unsupported" | "development" | "installing" | "ready" | "error";

export interface OfflineReadiness {
  shell: OfflineShellState;
  cacheAvailable: boolean;
  persistent: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

const EMPTY_READINESS: OfflineReadiness = {
  shell: "unsupported",
  cacheAvailable: false,
  persistent: null,
  usageBytes: null,
  quotaBytes: null,
};

let shellRegistration: Promise<ServiceWorkerRegistration | null> | null = null;

async function storageDetails(shell: OfflineShellState): Promise<OfflineReadiness> {
  if (typeof navigator === "undefined") return EMPTY_READINESS;
  const cacheAvailable = typeof caches !== "undefined";
  let persistent: boolean | null = null;
  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    persistent = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    usageBytes = typeof estimate?.usage === "number" ? estimate.usage : null;
    quotaBytes = typeof estimate?.quota === "number" ? estimate.quota : null;
  } catch {
    // Ein blockierter Estimate darf den lokalen Modus nicht unbrauchbar machen.
  }
  return { shell, cacheAvailable, persistent, usageBytes, quotaBytes };
}

export async function inspectOfflineReadiness(): Promise<OfflineReadiness> {
  if (typeof navigator === "undefined") return EMPTY_READINESS;
  if (!("serviceWorker" in navigator)) return storageDetails("unsupported");
  if (process.env.NODE_ENV !== "production") return storageDetails("development");
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const ready = Boolean(registration?.active && registration.active.scriptURL.endsWith("/sw.js"));
    return storageDetails(ready ? "ready" : "installing");
  } catch {
    return storageDetails("error");
  }
}

export async function prepareOfflineShell(): Promise<OfflineReadiness> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return EMPTY_READINESS;
  if (process.env.NODE_ENV !== "production") return storageDetails("development");
  try {
    shellRegistration ||= navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await shellRegistration;
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("OFFLINE_SHELL_TIMEOUT")), 20_000)),
    ]);
    return storageDetails("ready");
  } catch {
    shellRegistration = null;
    return storageDetails("error");
  }
}

export async function requestPersistentModelStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function remainingStorageBytes(status: OfflineReadiness): number | null {
  if (status.quotaBytes === null || status.usageBytes === null) return null;
  return Math.max(0, status.quotaBytes - status.usageBytes);
}
