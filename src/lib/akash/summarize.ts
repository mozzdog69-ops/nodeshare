import { formatAkashPrice } from "@/lib/akash/pricing";

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
  gpu: string;
  resources: string;
  resourceChips: string[];
  price: string;
  priceNote: string;
  priceMonthly: string | null;
  badge: string;
  state: string;
  orderRef: string;
  provider: string;
  hasGpu: boolean;
};

type ParsedResource = {
  cpu: string;
  memory: string;
  storage: string;
  gpu: string;
  price: string;
  priceNote: string;
  priceMonthly: string | null;
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
    const keyL = key.toLowerCase();

    const modelInKey = key.match(/model\/([^/]+)/i)?.[1];
    if (modelInKey) {
      if (modelInKey === "*" || modelInKey === "any") return "NVIDIA GPU (any model)";
      return `NVIDIA ${modelInKey.replace(/\*/g, "").trim()}`;
    }

    if (keyL.includes("vendor/nvidia") || keyL.includes("nvidia")) {
      if (val && val !== "true" && !/^\*+$/.test(val)) return `NVIDIA ${val}`;
      return "NVIDIA GPU";
    }
    if (keyL.includes("vendor/amd") || keyL.includes("amd")) return "AMD GPU";

    const blob = `${key} ${val}`;
    const named =
      blob.match(/\b(A100|A10|H100|L40S?|RTX\s*\d+|Tesla\s*\w+|MI250)\b/i)?.[0];
    if (named) return `NVIDIA ${named}`;
  }
  return "";
}

function shortenAkashAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-4)}`;
}

function parseResourceGroup(entry: unknown): ParsedResource | null {
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
    const label = gpuFromAttributes(g.attributes);
    if (label) gpu = units != null && units > 1 ? `${label} ×${units}` : label;
    else if (units != null && units > 0) gpu = `${units} GPU`;
  }

  let price = "—";
  let priceNote = "";
  let priceMonthly: string | null = null;
  if (o.price && typeof o.price === "object") {
    const p = o.price as { amount?: string; denom?: string };
    if (p.amount && p.denom) {
      const fmt = formatAkashPrice(p.amount, p.denom);
      price = fmt.perBlock;
      priceNote = fmt.note;
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
    priceMonthly,
  };
}

function parseOrder(raw: unknown): {
  id: string;
  state: string;
  title: string;
  orderRef: string;
  provider: string;
  resource: ParsedResource;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  let id = "";
  let orderRef = "";
  let provider = "";
  if (o.id && typeof o.id === "object") {
    const I = o.id as Record<string, unknown>;
    const dseq = String(I.dseq ?? "");
    const gseq = I.gseq;
    const oseq = I.oseq;
    if (typeof I.owner === "string" && I.owner) {
      provider = shortenAkashAddr(I.owner);
    }
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
  }

  const resources = spec && typeof spec === "object" ? (spec as { resources?: unknown }).resources : null;
  const first = Array.isArray(resources) ? parseResourceGroup(resources[0]) : null;
  const resource: ParsedResource = first ?? {
    cpu: "",
    memory: "",
    storage: "",
    gpu: "",
    price: "—",
    priceNote: "",
    priceMonthly: null,
  };

  const title = displayTitle(rawName, resource, orderRef);

  return { id, state, title, orderRef, provider, resource };
}

function resourceSummary(r: ParsedResource): string {
  const parts = [r.gpu, r.cpu, r.memory, r.storage].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Compute (see order spec)";
}

function resourceChips(r: ParsedResource): string[] {
  return [r.gpu, r.cpu, r.memory, r.storage].filter(Boolean);
}

function displayTitle(
  rawName: string,
  r: ParsedResource,
  orderRef: string,
): string {
  const generic =
    !rawName.trim() || /^akash$/i.test(rawName.trim()) || rawName.trim().length < 3;
  if (!generic) return rawName.trim();
  if (r.gpu) return r.gpu.includes("NVIDIA") || r.gpu.includes("AMD") ? r.gpu : `GPU · ${r.gpu}`;
  const summary = resourceSummary(r);
  if (summary !== "Compute (see order spec)") {
    return summary.split(" · ")[0] ?? "Open bid";
  }
  return orderRef ? `Open bid · ${orderRef}` : "Akash open bid";
}

function orderId(raw: unknown, index: number): string {
  const p = parseOrder(raw);
  return p?.id ?? `akash-order-${index}`;
}

function latencyFromId(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * (i + 1)) % 97;
  return `${18 + (n % 55)} ms (est.)`;
}

export function ordersToMapNodes(orders: unknown[]): MapNode[] {
  return orders.map((raw, i) => {
    const p = parseOrder(raw);
    const id = p?.id ?? orderId(raw, i);
    const { x, y } = hashToXY(id);
    const r = p?.resource;
    return {
      id,
      x,
      y,
      label: p?.title ?? `Order ${i + 1}`,
      latency: latencyFromId(id),
      cost: r?.price ?? "—",
      gpu: r?.gpu || resourceSummary(r ?? { cpu: "", memory: "", storage: "", gpu: "", price: "", priceNote: "", priceMonthly: null }),
      provider: "Akash",
      raw,
    };
  });
}

export function ordersToOfferCards(orders: unknown[], limit: number): OfferCard[] {
  return orders.slice(0, limit).flatMap((raw) => {
    const p = parseOrder(raw);
    if (!p) return [];
    const r = p.resource;
    const chips = resourceChips(r);
    return [
      {
        id: p.id,
        title: p.title,
        gpu: r.gpu || "CPU · general compute",
        resources: resourceSummary(r),
        resourceChips: chips.length ? chips : ["Compute"],
        price: r.price,
        priceNote: r.priceNote,
        priceMonthly: r.priceMonthly,
        badge: p.state === "open" ? "Open bid" : p.state,
        state: p.state,
        orderRef: p.orderRef,
        provider: p.provider || "Akash network",
        hasGpu: Boolean(r.gpu),
      },
    ];
  });
}
