import type { ProviderGpuModel } from "@/lib/akash/gpu-models";
import { readProviderGpuStats } from "@/lib/akash/provider-gpu-capacity";

const CONSOLE_BASE =
  process.env.AKASH_CONSOLE_API_URL?.trim().replace(/\/$/, "") ||
  "https://console-api.akash.network";

export type ProviderConsoleMeta = {
  isOnline: boolean;
  /** Free GPU slots on host (-1 if Console omitted stats). */
  gpuAvailable: number;
  gpuTotal: number;
};

type ConsoleProvider = {
  owner?: string;
  isOnline?: boolean;
  gpuModels?: ProviderGpuModel[];
  hardwareGpuModels?: string[];
  stats?: { gpu?: { available?: number; total?: number; active?: number } };
};

export async function fetchConsoleProvidersByOwner(): Promise<{
  providersByOwner: Record<string, ProviderGpuModel[]>;
  providerMetaByOwner: Record<string, ProviderConsoleMeta>;
  source: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${CONSOLE_BASE}/v1/providers`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) {
      return {
        providersByOwner: {},
        providerMetaByOwner: {},
        source: CONSOLE_BASE,
        error: `Console API HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as ConsoleProvider[] | { providers?: ConsoleProvider[] };
    const list = Array.isArray(json) ? json : Array.isArray(json.providers) ? json.providers : [];

    const providersByOwner: Record<string, ProviderGpuModel[]> = {};
    const providerMetaByOwner: Record<string, ProviderConsoleMeta> = {};
    for (const p of list) {
      const owner = String(p.owner || "").trim().toLowerCase();
      if (!/^akash[a-z0-9]{20,}$/i.test(owner)) continue;
      const models: ProviderGpuModel[] = [];
      if (Array.isArray(p.gpuModels)) {
        for (const g of p.gpuModels) {
          if (g?.model) models.push(g);
        }
      }
      if (models.length === 0 && Array.isArray(p.hardwareGpuModels)) {
        for (const name of p.hardwareGpuModels) {
          if (name) models.push({ vendor: "nvidia", model: String(name) });
        }
      }
      if (models.length > 0) {
        const gpuStats = readProviderGpuStats(p);
        providersByOwner[owner] = models;
        providerMetaByOwner[owner] = {
          isOnline: p.isOnline !== false,
          gpuAvailable: gpuStats?.available ?? -1,
          gpuTotal: gpuStats?.total ?? 0,
        };
      }
    }

    return {
      providersByOwner,
      providerMetaByOwner,
      source: `${CONSOLE_BASE}/v1/providers`,
    };
  } catch (e) {
    return {
      providersByOwner: {},
      providerMetaByOwner: {},
      source: CONSOLE_BASE,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
