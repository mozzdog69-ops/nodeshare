import type { DirectRentProgressSnapshot } from "@/lib/akash/direct-rent-steps";

const KEY_PREFIX = "nodeshare_direct_rent_progress_";

function storageKey(akashAddress: string) {
  return `${KEY_PREFIX}${String(akashAddress || "").toLowerCase()}`;
}

export function saveDirectRentProgress(akashAddress: string, progress: DirectRentProgressSnapshot) {
  if (!akashAddress || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(akashAddress),
      JSON.stringify({ ...progress, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

export function readDirectRentProgress(akashAddress: string): DirectRentProgressSnapshot | null {
  if (!akashAddress || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(akashAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DirectRentProgressSnapshot & { savedAt?: string };
    if (!parsed?.steps) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDirectRentProgress(akashAddress: string) {
  if (!akashAddress || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(akashAddress));
  } catch {
    /* ignore */
  }
}

/** True if rent is mid-flight (not fully done, not failed). */
export function isRentProgressInFlight(progress: DirectRentProgressSnapshot | null): boolean {
  if (!progress || progress.failedStep) return false;
  const ids = ["mint_act", "create_deployment", "provider_bids", "accept_lease", "manifest"] as const;
  const allDone = ids.every(
    (id) => progress.steps[id]?.status === "complete" || progress.steps[id]?.status === "skipped",
  );
  if (allDone) return false;
  return ids.some((id) => progress.steps[id]?.status !== "pending");
}

export function isRentProgressFailed(progress: DirectRentProgressSnapshot | null): boolean {
  return Boolean(progress?.failedStep);
}
