import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";

export type BidResourceSummary = {
  cpuUnits: number;
  memoryBytes: number;
  storageBytes: number;
  gpuAttributeKeys: string[];
};

export type DeploymentOpenBid = {
  provider: string;
  resources: BidResourceSummary;
  bidId: {
    owner: string;
    dseq: number;
    gseq: number;
    oseq: number;
    bseq: number;
    provider: string;
  };
};

export type DeploymentBidRequirements = {
  minCpuUnits: number;
  minMemoryBytes: number;
  minStorageBytes: number;
};

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

function parseBidResources(bid: Record<string, unknown>): BidResourceSummary {
  const offers = bid.resources_offer as { resources?: Record<string, unknown> }[] | undefined;
  const resources = (offers?.[0]?.resources ?? {}) as Record<string, unknown>;
  const cpu = resources.cpu as { units?: { val?: string } } | undefined;
  const memory = resources.memory as { quantity?: { val?: string } } | undefined;
  const storage = resources.storage as { quantity?: { val?: string } }[] | undefined;
  const gpu = resources.gpu as { attributes?: { key?: string }[] } | undefined;

  return {
    cpuUnits: Number(cpu?.units?.val ?? 0),
    memoryBytes: Number(memory?.quantity?.val ?? 0),
    storageBytes: Number(storage?.[0]?.quantity?.val ?? 0),
    gpuAttributeKeys: (gpu?.attributes ?? [])
      .map((a) => String(a?.key ?? "").trim())
      .filter(Boolean),
  };
}

function parseBidRow(
  row: unknown,
  owner: string,
  dseq: number,
  allowedStates: Set<string> = new Set(["open"]),
): DeploymentOpenBid | null {
  const bid = (row as { bid?: Record<string, unknown> }).bid ?? (row as Record<string, unknown>);
  const id = (bid.id ?? {}) as Record<string, unknown>;
  const provider = String(id.provider ?? "").trim().toLowerCase();
  if (!/^akash1[a-z0-9]{38}$/.test(provider)) return null;
  const state = String(bid.state ?? "open").toLowerCase();
  if (!allowedStates.has(state)) return null;
  return {
    provider,
    resources: parseBidResources(bid),
    bidId: {
      owner: String(id.owner ?? owner),
      dseq: Number(id.dseq ?? dseq),
      gseq: Number(id.gseq ?? 1),
      oseq: Number(id.oseq ?? 1),
      bseq: Number(id.bseq ?? 0),
      provider,
    },
  };
}

export function bidMeetsDeploymentRequirements(
  bid: Pick<DeploymentOpenBid, "resources">,
  requirements?: DeploymentBidRequirements,
): boolean {
  if (!requirements) return true;
  const r = bid.resources;
  return (
    r.cpuUnits >= requirements.minCpuUnits &&
    r.memoryBytes >= requirements.minMemoryBytes &&
    r.storageBytes >= requirements.minStorageBytes
  );
}

export function bidMatchesGpuModelSlug(
  bid: Pick<DeploymentOpenBid, "resources">,
  gpuModelSlug?: string,
): boolean {
  const slug = String(gpuModelSlug || "").trim().toLowerCase();
  if (!slug) return false;
  return bid.resources.gpuAttributeKeys.some(
    (key) =>
      key.toLowerCase().includes(`/model/${slug}`) ||
      key.toLowerCase().includes("/model/*"),
  );
}

export function bidOffersAnyNvidiaWildcard(
  bid: Pick<DeploymentOpenBid, "resources">,
): boolean {
  return bid.resources.gpuAttributeKeys.some((key) =>
    /\/model\/\*$|\/model\/\*\/true/.test(key.toLowerCase()),
  );
}

async function fetchBidsFromLcdUrl(
  url: string,
  owner: string,
  dseq: number,
  allowedStates: Set<string>,
): Promise<DeploymentOpenBid[]> {
  try {
    const res = await fetch(url, {
      headers: AKASH_FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { bids?: unknown[] };
    return (json.bids ?? [])
      .map((row) => parseBidRow(row, owner, dseq, allowedStates))
      .filter((b): b is DeploymentOpenBid => Boolean(b));
  } catch {
    return [];
  }
}

function mergeBidsByProvider(bids: DeploymentOpenBid[]): DeploymentOpenBid[] {
  const byProvider = new Map<string, DeploymentOpenBid>();
  for (const bid of bids) {
    const prev = byProvider.get(bid.provider);
    if (!prev || bid.resources.gpuAttributeKeys.length > prev.resources.gpuAttributeKeys.length) {
      byProvider.set(bid.provider, bid);
    }
  }
  return [...byProvider.values()];
}

/** REST fallback when chain-sdk bid queries lag behind LCD (parallel mirrors + open-state merge). */
export async function fetchOpenDeploymentBidsLcd(
  owner: string,
  dseq: number,
): Promise<DeploymentOpenBid[]> {
  const openQs = new URLSearchParams({
    "filters.owner": owner,
    "filters.dseq": String(dseq),
    "filters.state": "open",
    "pagination.limit": "30",
  });
  const anyQs = new URLSearchParams({
    "filters.owner": owner,
    "filters.dseq": String(dseq),
    "pagination.limit": "30",
  });

  const tasks: Promise<DeploymentOpenBid[]>[] = [];
  for (const base of lcdBases()) {
    for (const ver of ["v1beta5", "v1beta4"] as const) {
      tasks.push(
        fetchBidsFromLcdUrl(
          `${base}/akash/market/${ver}/bids/list?${openQs}`,
          owner,
          dseq,
          new Set(["open"]),
        ),
      );
      tasks.push(
        fetchBidsFromLcdUrl(
          `${base}/akash/market/${ver}/bids/list?${anyQs}`,
          owner,
          dseq,
          new Set(["open", "active"]),
        ),
      );
    }
  }

  const batches = await Promise.all(tasks);
  return mergeBidsByProvider(batches.flat());
}

/** Bid row for a leased provider (state active). */
export async function fetchLeaseProviderBidLcd(
  owner: string,
  dseq: number,
  provider: string,
): Promise<DeploymentOpenBid | null> {
  const want = provider.trim().toLowerCase();
  const qs = new URLSearchParams({
    "filters.owner": owner,
    "filters.dseq": String(dseq),
    "pagination.limit": "30",
  });

  for (const base of lcdBases()) {
    const url = `${base}/akash/market/v1beta5/bids/list?${qs}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { bids?: unknown[] };
      for (const row of json.bids ?? []) {
        const parsed = parseBidRow(row, owner, dseq, new Set(["open", "active"]));
        if (parsed && parsed.provider === want) return parsed;
      }
    } catch {
      /* next */
    }
  }
  return null;
}
