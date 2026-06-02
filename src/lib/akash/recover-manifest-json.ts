import { fetchDeploymentHashLcd } from "@/lib/akash/fetch-deployment-hash";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { parseGpuSdl, type GpuSdlInput } from "@/lib/akash/gpu-sdl";
import {
  manifestHashBase64BrokenStrip,
  manifestHashBase64FromJson,
  manifestHashBase64SdkLegacy,
  manifestHashBase64StrippedCanon,
  resolveManifestBodyForOnChainHash,
} from "@/lib/akash/manifest-version-go";
import { readRentManifestJsonForDseq } from "@/lib/gpu/job-storage";

export type DeploymentLcdRow = {
  deployment?: { id?: { dseq?: string | number }; hash?: string };
  groups?: {
    group_spec?: {
      name?: string;
      requirements?: { signed_by?: { any_of?: string[] } };
      resources?: {
        resource?: {
          cpu?: { units?: { val?: string } };
          memory?: { quantity?: { val?: string } };
          storage?: { quantity?: { val?: string } }[];
          gpu?: { attributes?: { key?: string; value?: string }[] };
        };
        price?: { denom?: string; amount?: string };
      }[];
    };
  }[];
};

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

/** Deployment list row (includes group_spec) for a single dseq. */
export async function fetchDeploymentRowLcd(
  owner: string,
  dseq: number,
): Promise<DeploymentLcdRow | null> {
  const qs = new URLSearchParams({
    "filters.owner": owner,
    "pagination.limit": "50",
  });
  for (const base of lcdBases()) {
    for (const ver of ["v1beta4", "v1beta3"] as const) {
      const url = `${base}/akash/deployment/${ver}/deployments/list?${qs}`;
      try {
        const res = await fetch(url, {
          headers: AKASH_FETCH_HEADERS,
          cache: "no-store",
          signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { deployments?: DeploymentLcdRow[] };
        const row = (json.deployments ?? []).find(
          (entry) => String(entry.deployment?.id?.dseq ?? "") === String(dseq),
        );
        if (row) return row;
      } catch {
        /* next */
      }
    }
  }
  return null;
}

/** Build SDL inputs from the deployment actually stored on Akash (source of truth for manifest hash). */
export function inferGpuSdlFromDeploymentRow(
  row: DeploymentLcdRow,
  hints: GpuSdlInput = { hourlyAkt: 0.12, hours: 1 },
): GpuSdlInput {
  const spec = row.groups?.[0]?.group_spec;
  const resEntry = spec?.resources?.[0];
  const res = resEntry?.resource;

  const cpuMilli = Number(res?.cpu?.units?.val ?? 0);
  const cpuUnits = cpuMilli > 0 ? Math.max(1, Math.round(cpuMilli / 1000)) : undefined;
  const memoryBytes = Number(res?.memory?.quantity?.val ?? 0);
  const memoryGi =
    memoryBytes > 0 ? Math.max(1, Math.round(memoryBytes / 1024 ** 3)) : undefined;
  const storageBytes = Number(res?.storage?.[0]?.quantity?.val ?? 0);
  const storageGi =
    storageBytes > 0 ? Math.max(1, Math.round(storageBytes / 1024 ** 3)) : undefined;

  const gpuAttrs = res?.gpu?.attributes ?? [];
  const modelAttr = gpuAttrs.find((a) => a.key?.includes("/model/") && a.value === "true");
  let anyNvidiaGpu = true;
  let gpuModelSlug: string | undefined;
  if (modelAttr?.key) {
    const key = modelAttr.key;
    if (key.includes("/model/*") || /\/model\/\*$/.test(key)) {
      anyNvidiaGpu = true;
      gpuModelSlug = undefined;
    } else {
      const slug = key.split("/model/")[1]?.split("/").filter(Boolean)[0];
      if (slug && slug !== "*") {
        anyNvidiaGpu = false;
        gpuModelSlug = slug;
      }
    }
  }

  const anyOf = spec?.requirements?.signed_by?.any_of ?? [];
  const openToAnyProvider = anyOf.length === 0;
  const priceRaw = String(resEntry?.price?.amount ?? "").trim();
  const uactPerBlockOverride = priceRaw ? priceRaw.split(".")[0] || undefined : undefined;

  return {
    ...hints,
    cpuUnits: cpuUnits ?? hints.cpuUnits,
    memoryGi: memoryGi ?? hints.memoryGi,
    storageGi: storageGi ?? hints.storageGi,
    anyNvidiaGpu,
    gpuModelSlug: anyNvidiaGpu ? undefined : gpuModelSlug ?? hints.gpuModelSlug,
    gpuLabel: anyNvidiaGpu ? undefined : hints.gpuLabel,
    gpuVram: anyNvidiaGpu ? undefined : hints.gpuVram,
    gpuInterface: anyNvidiaGpu ? undefined : hints.gpuInterface,
    openToAnyProvider,
    providerOwner: openToAnyProvider ? undefined : anyOf[0],
    providerOwners: openToAnyProvider ? undefined : anyOf,
    uactPerBlockOverride: uactPerBlockOverride ?? hints.uactPerBlockOverride,
    bidEscalation: hints.bidEscalation ?? 1.4,
  };
}

function hashBytesToBase64(hash: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(hash).toString("base64");
  }
  let binary = "";
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function manifestMatchesOnChain(manifestJson: string, onChainHashB64: string): Promise<boolean> {
  const resolved = await resolveManifestBodyForOnChainHash(manifestJson, onChainHashB64);
  return (
    resolved.matched &&
    !resolved.legacyOnChain &&
    !resolved.brokenStrip &&
    !resolved.strippedCanon
  );
}

/** Try SDL variants until manifest hash matches the deployment on Akash. */
export async function recoverManifestJsonForDeployment(
  owner: string,
  dseq: number,
  onChainHashB64: string,
  hints: GpuSdlInput = { hourlyAkt: 0.12, hours: 1 },
): Promise<string | null> {
  const row = await fetchDeploymentRowLcd(owner, dseq);
  const variants: GpuSdlInput[] = [];

  if (row) {
    variants.push(inferGpuSdlFromDeploymentRow(row, hints));
  }

  const anyNvidia = row ? inferGpuSdlFromDeploymentRow(row, hints).anyNvidiaGpu : true;
  if (anyNvidia) {
    variants.push(
      {
        ...hints,
        openToAnyProvider: true,
        anyNvidiaGpu: true,
        gpuModelSlug: undefined,
        gpuLabel: undefined,
        gpuVram: undefined,
        gpuInterface: undefined,
        bidEscalation: 1.4,
      },
      { ...hints, openToAnyProvider: true, anyNvidiaGpu: true, bidEscalation: 1.25 },
    );
  }
  if (hints.gpuModelSlug || hints.gpuLabel) {
    variants.push({
      ...hints,
      openToAnyProvider: true,
      anyNvidiaGpu: false,
      bidEscalation: 1.25,
    });
  }

  const seen = new Set<string>();
  for (const input of variants) {
    const key = JSON.stringify(input);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const parsed = await parseGpuSdl(input);
      const hashB64 = hashBytesToBase64(parsed.hash);
      if (hashB64 === onChainHashB64) {
        return parsed.manifestJson;
      }
      const legacyB64 = await manifestHashBase64SdkLegacy(parsed.manifest);
      const brokenB64 = await manifestHashBase64BrokenStrip(parsed.manifest);
      const strippedB64 = await manifestHashBase64StrippedCanon(
        parsed.manifest,
        (jsonStr) => (parsed.sdl as { SortJSON: (j: string) => string }).SortJSON(jsonStr),
      );
      if (
        legacyB64 === onChainHashB64 ||
        brokenB64 === onChainHashB64 ||
        strippedB64 === onChainHashB64
      ) {
        return null;
      }
    } catch {
      /* try next variant */
    }
  }
  return null;
}

/**
 * Resolve manifest JSON that matches on-chain deployment hash.
 * Never returns an unverified client manifest.
 */
/** Rebuild manifest from on-chain deployment via chain-sdk (provider Manifest.Version path). */
export async function buildManifestFromDeploymentRow(
  row: DeploymentLcdRow,
  onChainHashB64: string,
  hints: GpuSdlInput,
): Promise<string | null> {
  try {
    const parsed = await parseGpuSdl(inferGpuSdlFromDeploymentRow(row, hints));
    const hashB64 = hashBytesToBase64(parsed.hash);
    const legacyB64 = await manifestHashBase64SdkLegacy(parsed.manifest);
    const brokenB64 = await manifestHashBase64BrokenStrip(parsed.manifest);
    const strippedB64 = await manifestHashBase64StrippedCanon(
      parsed.manifest,
      (jsonStr) => (parsed.sdl as { SortJSON: (j: string) => string }).SortJSON(jsonStr),
    );
    if (
      (legacyB64 === onChainHashB64 ||
        brokenB64 === onChainHashB64 ||
        strippedB64 === onChainHashB64) &&
      hashB64 !== onChainHashB64
    ) {
      return null;
    }
    if (hashB64 === onChainHashB64) return parsed.manifestJson;
  } catch {
    /* try recovery variants */
  }
  return null;
}

export async function resolveManifestJsonForDeployment(input: {
  owner: string;
  dseq: number;
  manifestJson?: string;
  hints?: GpuSdlInput;
}): Promise<string> {
  const owner = input.owner.trim();
  const dseq = input.dseq;
  const hints = input.hints ?? { hourlyAkt: 0.12, hours: 1 };
  const row = await fetchDeploymentRowLcd(owner, dseq);
  const onChainHash =
    (await fetchDeploymentHashLcd(owner, dseq)) ??
    row?.deployment?.hash?.trim() ??
    null;

  if (row && onChainHash) {
    const fromRow = await buildManifestFromDeploymentRow(row, onChainHash, hints);
    if (fromRow) return fromRow;
  }

  const candidates: string[] = [];
  const explicit = input.manifestJson?.trim();
  if (explicit) candidates.push(explicit);
  const fromJob = readRentManifestJsonForDseq(owner, dseq);
  if (fromJob && !candidates.includes(fromJob)) candidates.push(fromJob);

  if (onChainHash) {
    for (const raw of candidates) {
      if (await manifestMatchesOnChain(raw, onChainHash)) {
        const { body } = await resolveManifestBodyForOnChainHash(raw, onChainHash);
        if (row) {
          const fromRow = await buildManifestFromDeploymentRow(row, onChainHash, hints);
          if (fromRow) return fromRow;
        }
        return body;
      }
    }

    const recovered = await recoverManifestJsonForDeployment(owner, dseq, onChainHash, hints);
    if (recovered) return recovered;

    throw new Error(
      "Could not build a manifest matching this deployment on Akash. Close on Stuck orders and rent again.",
    );
  }

  if (candidates[0]) {
    return candidates[0];
  }

  if (row) {
    try {
      const parsed = await parseGpuSdl(inferGpuSdlFromDeploymentRow(row, hints));
      return parsed.manifestJson;
    } catch {
      /* fall through */
    }
  }

  throw new Error(
    "Akash network data is temporarily unavailable — wait a moment and tap Retry manifest again.",
  );
}
