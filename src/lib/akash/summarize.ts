import {
  formatGpuModelName,
  formatProviderGpuInventory,
  formatProviderGpuModel,
  formatVendorLabel,
  isGenericGpuLabel,
  labelFromGpuAttributeKey,
  resolveOfferGpuHeadline,
  type ProviderGpuModel,
} from "@/lib/akash/gpu-models";
import { formatAkashPrice } from "@/lib/akash/pricing";
import { parseHourlyAkt, parseHourlyUsd } from "@/lib/gpu/quote-utils";

export type MapNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  latency: string;
  cost: string;
  gpu: string;
  provider: "Akash";
  raw: unknown;
};

export type OfferCard = {
  id: string;
  title: string;
  resources: string;
  resourceChips: string[];
  price: string;
  priceNote: string;
  priceHourly: string | null;
  priceMonthly: string | null;
  badge: string;
  state: string;
  orderRef: string;
  hasGpu: boolean;
  provider: string;
  /** Full akash1… owner when parsed from LCD order id */
  providerOwner?: string;
  basePriceUsd: number | null;
  basePriceAkt: number | null;
  gpuModel: string | null;
  /** Full provider GPU list from Akash Console when bid is open/generic */
  providerGpuInventory: string | null;
  /** Raw chain price.amount from LCD order (for SDL bid matching). */
  priceAmount?: string;
  priceDenom?: string;
};

type ParsedResource = {
  cpu: string;
  memory: string;
  storage: string;
  gpu: string;
  price: string;
  priceNote: string;
  priceHourly: string | null;
  priceMonthly: string | null;
  priceAmount?: string;
  priceDenom?: string;
};

function hashToXY(id: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const x = 10 + ((u % 1000) / 1000) * 80;
  const y = 12 + (((u >> 10) % 1000) / 1000) * 72;
  return { x, y };
}

function readUnits(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "object" && val !== null && "val" in val) {
    const v = (val as { val?: unknown }).val;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "number") return v;
  }
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}

function formatCpu(units: number | null): string {
  if (units == null || units <= 0) return "";
  const cores = units / 1000;
  if (cores >= 1) {
    return `${cores % 1 === 0 ? cores.toFixed(0) : cores.toFixed(1)} vCPU`;
  }
  return `${units} mCPU`;
}

function gpuFromAttributes(attrs: unknown): string {
  if (!Array.isArray(attrs)) return "";
  for (const a of attrs) {
    if (!a || typeof a !== "object") continue;
    const o = a as { key?: string; value?: string };
    const key = (o.key ?? "").trim();
    const val = (o.value ?? "").trim();
    const fromKey = labelFromGpuAttributeKey(key, val);
    if (fromKey) return fromKey;

    const blob = `${key} ${val}`;
    const named =
      blob.match(/\b(A100|A10|H100|L40S?|RTX\s*\d+\s*Ti?|Tesla\s*\w+|MI250|4090|3090|4080)\b/i)?.[0];
    if (named) return `NVIDIA ${named.replace(/\s+/g, " ").trim()}`;
  }
  return "";
}

function resolveGpuLabel(
  attrs: unknown,
  providerModels?: ProviderGpuModel[],
): string {
  const fromBid = gpuFromAttributes(attrs);
  const { headline } = resolveOfferGpuHeadline(fromBid, providerModels);
  return headline;
}

function shortenAkashAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-4)}`;
}

function parseResourceGroup(
  entry: unknown,
  providerOwner: string,
  providersByOwner?: Record<string, ProviderGpuModel[]>,
): ParsedResource | null {
  if (!entry || typeof entry !== "object") return null;
  const o = entry as Record<string, unknown>;
  const resource = o.resource;
  if (!resource || typeof resource !== "object") return null;
  const r = resource as Record<string, unknown>;

  const cpu = formatCpu(readUnits(r.cpu && typeof r.cpu === "object" ? (r.cpu as { units?: unknown }).units : null));
  const memUnits =
    r.memory && typeof r.memory === "object"
      ? readUnits((r.memory as { quantity?: unknown }).quantity)
      : null;
  const memory = memUnits != null ? formatBytes(memUnits) : "";

  let storage = "";
  if (Array.isArray(r.storage) && r.storage[0] && typeof r.storage[0] === "object") {
    const sq = readUnits((r.storage[0] as { quantity?: unknown }).quantity);
    if (sq != null) storage = formatBytes(sq);
  }

  let gpu = "";
  if (r.gpu && typeof r.gpu === "object") {
    const g = r.gpu as { units?: unknown; attributes?: unknown };
    const units = readUnits(g.units);
    const ownerKey = providerOwner.trim().toLowerCase();
    const providerModels = ownerKey ? providersByOwner?.[ownerKey] : undefined;
    const label = resolveGpuLabel(g.attributes, providerModels);
    if (label) gpu = units != null && units > 1 ? `${label} ×${units}` : label;
    else if (units != null && units > 0) gpu = `${units} GPU`;
  }

  let price = "—";
  let priceNote = "";
  let priceHourly: string | null = null;
  let priceMonthly: string | null = null;
  let priceAmount: string | undefined;
  let priceDenom: string | undefined;
  if (o.price && typeof o.price === "object") {
    const p = o.price as { amount?: string; denom?: string };
    if (p.amount && p.denom) {
      priceAmount = String(p.amount);
      priceDenom = String(p.denom);
      const fmt = formatAkashPrice(p.amount, p.denom);
      price = fmt.perBlock;
      priceNote = fmt.note;
      priceHourly = fmt.hourlyEstimate;
      priceMonthly = fmt.monthlyEstimate;
    }
  }

  return {
    cpu,
    memory,
    storage,
    gpu: gpu || "",
    price,
    priceNote,
    priceHourly,
    priceMonthly,
    priceAmount,
    priceDenom,
  };
}

/** @deprecated SDL signedBy lists auditors, not providers — do not use for provider targeting. */
function readTargetProvider(_spec: unknown): string {
  return "";
}

function parseOrder(
  raw: unknown,
  providersByOwner?: Record<string, ProviderGpuModel[]>,
): {
  id: string;
  state: string;
  title: string;
  orderRef: string;
  provider: string;
  providerOwner: string;
  resource: ParsedResource;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  let id = "";
  let orderRef = "";
  let provider = "";
  let providerOwner = "";
  if (o.id && typeof o.id === "object") {
    const I = o.id as Record<string, unknown>;
    const dseq = String(I.dseq ?? "");
    const gseq = I.gseq;
    const oseq = I.oseq;
    orderRef = dseq ? `dseq ${dseq}` : "";
    if (typeof gseq === "number" && typeof oseq === "number") {
      id = `${dseq}-${gseq}-${oseq}`;
      orderRef = `dseq ${dseq} · g${gseq} · o${oseq}`;
    } else if ("oid" in I) {
      id = String(I.oid);
    }
  }
  if (!id) return null;

  const state = String(o.state ?? "open");
  let rawName = "";
  const spec = o.spec;
  if (spec && typeof spec === "object") {
    const name = (spec as { name?: string }).name;
    if (name && name.trim()) rawName = name.trim();
    const target = readTargetProvider(spec);
    if (target) {
      providerOwner = target;
      provider = shortenAkashAddr(target);
    }
  }

  const resources = spec && typeof spec === "object" ? (spec as { resources?: unknown }).resources : null;
  const first = Array.isArray(resources)
    ? parseResourceGroup(resources[0], providerOwner, providersByOwner)
    : null;
  const resource: ParsedResource = first ?? {
    cpu: "",
    memory: "",
    storage: "",
    gpu: "",
    price: "—",
    priceNote: "",
    priceHourly: null,
    priceMonthly: null,
  };

  const title = displayTitle(rawName, resource, orderRef);

  return { id, state, title, orderRef, provider, providerOwner, resource };
}

function resourceSummary(r: ParsedResource): string {
  const parts = [r.gpu, r.cpu, r.memory, r.storage].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Compute (see order spec)";
}

function resourceChips(r: ParsedResource, gpuHeadline: string | null): string[] {
  const chips = [r.gpu, r.cpu, r.memory, r.storage].filter(Boolean);
  if (!gpuHeadline) return chips.length ? chips : ["Compute"];
  return chips.filter(
    (c) =>
      c !== gpuHeadline &&
      !isGenericGpuLabel(c) &&
      !/^NVIDIA GPU$/i.test(c) &&
      !/NVIDIA GPU \(any model\)/i.test(c),
  );
}

function displayTitle(
  rawName: string,
  r: ParsedResource,
  orderRef: string,
): string {
  const dseq = orderRef.match(/dseq\s+(\d+)/)?.[1];
  const generic =
    !rawName.trim() || /^akash$/i.test(rawName.trim()) || rawName.trim().length < 3;
  if (!generic) return rawName.trim();
  if (r.gpu && !isGenericGpuLabel(r.gpu)) return r.gpu;
  if (dseq) return `Spot bid · dseq ${dseq}`;
  if (r.gpu) return r.gpu;
  const summary = resourceSummary(r);
  if (summary !== "Compute (see order spec)") {
    return summary.split(" · ")[0] ?? "Open bid";
  }
  return orderRef || "Akash open bid";
}

function orderId(raw: unknown, index: number, providersByOwner?: Record<string, ProviderGpuModel[]>) {
  const p = parseOrder(raw, providersByOwner);
  return p?.id ?? `akash-order-${index}`;
}

function latencyFromId(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * (i + 1)) % 97;
  return `${18 + (n % 55)} ms (est.)`;
}

export function ordersToMapNodes(
  orders: unknown[],
  providersByOwner?: Record<string, ProviderGpuModel[]>,
): MapNode[] {
  return orders.map((raw, i) => {
    const p = parseOrder(raw, providersByOwner);
    const id = p?.id ?? orderId(raw, i, providersByOwner);
    const { x, y } = hashToXY(id);
    const r = p?.resource;
    return {
      id,
      x,
      y,
      label: p?.title ?? `Order ${i + 1}`,
      latency: latencyFromId(id),
      cost: r?.price ?? "—",
      gpu: r?.gpu || resourceSummary(r ?? { cpu: "", memory: "", storage: "", gpu: "", price: "", priceNote: "", priceHourly: null, priceMonthly: null }),
      provider: "Akash",
      raw,
    };
  });
}

export function ordersToOfferCards(
  orders: unknown[],
  limit: number,
  providersByOwner?: Record<string, ProviderGpuModel[]>,
): OfferCard[] {
  return orders.slice(0, limit).flatMap((raw) => {
    const p = parseOrder(raw, providersByOwner);
    if (!p) return [];
    const r = p.resource;
    const ownerKey = p.providerOwner.trim().toLowerCase();
    const providerModels = ownerKey ? providersByOwner?.[ownerKey] : undefined;
    const { headline: gpuModel, inventoryDetail: providerGpuInventory } = resolveOfferGpuHeadline(
      r.gpu,
      providerModels,
    );
    const title = gpuModel && !isGenericGpuLabel(gpuModel) ? gpuModel : p.title;
    let chips = resourceChips(r, gpuModel);
    if (gpuModel && !isGenericGpuLabel(gpuModel) && !chips.some((c) => c.includes(gpuModel.split(" · ")[0]))) {
      chips = [gpuModel, ...chips];
    }
    return [
      {
        id: p.id,
        title,
        resources: resourceSummary(r),
        resourceChips: chips.length ? chips : ["Compute"],
        price: r.price,
        priceNote: r.priceNote,
        priceHourly: r.priceHourly,
        priceMonthly: r.priceMonthly,
        badge: p.state === "open" ? "Open bid" : p.state,
        state: p.state,
        orderRef: p.orderRef,
        hasGpu: Boolean(r.gpu),
        provider: p.provider || "Akash",
        providerOwner: p.providerOwner || undefined,
        basePriceUsd: parseHourlyUsd(r.priceHourly),
        basePriceAkt: parseHourlyAkt(r.priceHourly),
        gpuModel: gpuModel || null,
        providerGpuInventory,
        priceAmount: r.priceAmount,
        priceDenom: r.priceDenom,
      },
    ];
  });
}
