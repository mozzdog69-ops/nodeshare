import { readDirectRentProgress } from "@/lib/akash/direct-rent-progress-storage";

const GPU_JOBS_GLOBAL_KEY = "nodeshare_gpu_jobs_global";

function jobsStorageKey(address: string) {
  return `nodeshare_gpu_jobs_${String(address || "").toLowerCase()}`;
}

export function upsertLocalGpuJob(address: string, jobPatch: { id: string } & Record<string, unknown>) {
  if (!address || !jobPatch?.id) return;
  try {
    const key = jobsStorageKey(address);
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    const arr = Array.isArray(prev) ? prev : [];
    const idx = arr.findIndex((x: { id?: string }) => x?.id === jobPatch.id);
    const nextJob = { ...(idx >= 0 ? arr[idx] : {}), ...jobPatch };
    if (idx >= 0) arr[idx] = nextJob;
    else arr.unshift(nextJob);
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function upsertGlobalGpuJob(jobPatch: { id: string } & Record<string, unknown>) {
  if (!jobPatch?.id) return;
  try {
    const prev = JSON.parse(localStorage.getItem(GPU_JOBS_GLOBAL_KEY) || "[]");
    const arr = Array.isArray(prev) ? prev : [];
    const idx = arr.findIndex((x: { id?: string }) => x?.id === jobPatch.id);
    const nextJob = { ...(idx >= 0 ? arr[idx] : {}), ...jobPatch };
    if (idx >= 0) arr[idx] = nextJob;
    else arr.unshift(nextJob);
    localStorage.setItem(GPU_JOBS_GLOBAL_KEY, JSON.stringify(arr.slice(0, 500)));
  } catch {
    /* ignore */
  }
}

export function readLocalGpuJobs(address: string) {
  try {
    const raw = localStorage.getItem(jobsStorageKey(address));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Manifest JSON saved at deploy time for an open Akash dseq (browser only). */
export function readRentManifestJsonForDseq(address: string, dseq: number): string | undefined {
  if (!address || !dseq) return undefined;
  const match = (job: { dseq?: number; rent_sdl?: { manifestJson?: string } }) =>
    job.dseq === dseq && typeof job.rent_sdl?.manifestJson === "string";
  try {
    const local = readLocalGpuJobs(address).find(match);
    if (local?.rent_sdl?.manifestJson) return local.rent_sdl.manifestJson;
    const global = readGlobalGpuJobs().find(match);
    if (global?.rent_sdl?.manifestJson) return global.rent_sdl.manifestJson;
    const progress = readDirectRentProgress(address);
    if (progress?.dseq === dseq && progress.manifestJson?.trim()) {
      return progress.manifestJson.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function readGlobalGpuJobs() {
  try {
    const raw = localStorage.getItem(GPU_JOBS_GLOBAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalGpuJobs(address: string, jobs: unknown[]) {
  try {
    localStorage.setItem(jobsStorageKey(address), JSON.stringify(Array.isArray(jobs) ? jobs : []));
  } catch {
    /* ignore */
  }
}

/** Update every local/global job row matching an Akash deployment dseq. */
function mergeAkashJobPatch(
  job: { rent_sdl?: Record<string, unknown> },
  patch: Record<string, unknown>,
  dseq: number,
) {
  const rentPatch = patch.rent_sdl;
  const mergedRent =
    rentPatch && typeof rentPatch === "object"
      ? { ...(job.rent_sdl ?? {}), ...(rentPatch as Record<string, unknown>) }
      : job.rent_sdl;
  const { rent_sdl: _drop, ...restPatch } = patch;
  return {
    ...job,
    ...restPatch,
    ...(mergedRent ? { rent_sdl: mergedRent } : {}),
    dseq,
  };
}

export function markAkashDseqJobs(
  addresses: string[],
  dseq: number,
  patch: { id?: string } & Record<string, unknown>,
) {
  if (!dseq) return;
  const match = (job: { dseq?: number; id?: string }) =>
    job.dseq === dseq || String(job.id || "").includes(`-${dseq}-`);

  try {
    const global = JSON.parse(localStorage.getItem(GPU_JOBS_GLOBAL_KEY) || "[]");
    if (Array.isArray(global)) {
      let changed = false;
      const next = global.map((job: { dseq?: number; id?: string; rent_sdl?: Record<string, unknown> }) => {
        if (!match(job)) return job;
        changed = true;
        return mergeAkashJobPatch(job, patch, dseq);
      });
      if (changed) localStorage.setItem(GPU_JOBS_GLOBAL_KEY, JSON.stringify(next.slice(0, 500)));
    }
  } catch {
    /* ignore */
  }

  for (const address of addresses) {
    if (!address) continue;
    try {
      const key = jobsStorageKey(address);
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(prev)) continue;
      let changed = false;
      const next = prev.map((job: { dseq?: number; id?: string; rent_sdl?: Record<string, unknown> }) => {
        if (!match(job)) return job;
        changed = true;
        return mergeAkashJobPatch(job, patch, dseq);
      });
      if (changed) localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      /* ignore */
    }
  }
}

export function mergeGpuJobs(remoteJobs: unknown[], localJobs: unknown[]) {
  const map = new Map<string, Record<string, unknown>>();
  [...(Array.isArray(localJobs) ? localJobs : []), ...(Array.isArray(remoteJobs) ? remoteJobs : [])].forEach(
    (job) => {
      if (!job || typeof job !== "object") return;
      const j = job as { id?: string };
      if (!j.id) return;
      map.set(j.id, { ...(map.get(j.id) || {}), ...j });
    },
  );
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
  );
}
