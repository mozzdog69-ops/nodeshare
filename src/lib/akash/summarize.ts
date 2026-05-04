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

function hashToXY(id: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const x = 10 + (u % 1000) / 1000 * 80;
  const y = 12 + ((u >> 10) % 1000) / 1000 * 72;
  return { x, y };
}

function pickGpuHint(s: string): string {
  const m =
    s.match(/nvidia[^"\\]{0,48}/i) ??
    s.match(/NVIDIA[^"\\]{0,48}/) ??
    s.match(/A100|A10|H100|L40|RTX|mi250|tesla/i);
  if (m) return m[0]!.replace(/[",\\]+/g, "").slice(0, 40);
  if (s.toLowerCase().includes("gpu")) return "GPU (see order spec)";
  return "GPU / CPU (Akash order)";
}

function pickPrice(s: string, raw: unknown): string {
  if (raw && typeof raw === "object" && "price" in raw) {
    const p = (raw as { price?: { amount?: string; denom?: string } }).price;
    if (p?.amount && p?.denom) {
      const amt = Number(p.amount);
      if (Number.isFinite(amt) && p.denom === "uakt") {
        return `${(amt / 1_000_000).toFixed(3)} AKT / block (est.)`;
      }
      return `${p.amount} ${p.denom}`;
    }
  }
  const m = s.match(/"amount"\s*:\s*"(\d+)"\s*,\s*"denom"\s*:\s*"uakt"/);
  if (m) {
    return `${(Number(m[1]) / 1_000_000).toFixed(3)} AKT / block (est.)`;
  }
  return "See LCD order";
}

function orderId(raw: unknown, index: number): string {
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    if (id && typeof id === "object") {
      const o = id as Record<string, unknown>;
      if ("oid" in o) return String(o.oid ?? index);
      const dseq = o.dseq;
      const gseq = o.gseq;
      const oseq = o.oseq;
      if (
        (typeof dseq === "string" || typeof dseq === "number") &&
        typeof gseq === "number" &&
        typeof oseq === "number"
      ) {
        return `${dseq}-${gseq}-${oseq}`;
      }
    }
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return `akash-order-${index}`;
}

/** Deterministic fake latency label from id (no geo in LCD). */
function latencyFromId(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * (i + 1)) % 97;
  return `${18 + (n % 55)} ms (mesh est.)`;
}

/**
 * Turn raw LCD order JSON into map nodes + card rows.
 */
export function ordersToMapNodes(orders: unknown[]): MapNode[] {
  return orders.map((raw, i) => {
    const id = orderId(raw, i);
    const { x, y } = hashToXY(id);
    const s = JSON.stringify(raw);
    return {
      id,
      x,
      y,
      label: `Bid ${i + 1}`,
      latency: latencyFromId(id),
      cost: pickPrice(s, raw),
      gpu: pickGpuHint(s),
      provider: "Akash",
      raw,
    };
  });
}

export type OfferCard = {
  id: string;
  title: string;
  gpu: string;
  price: string;
  badge: string;
  slots: number;
};

export function ordersToOfferCards(orders: unknown[], limit: number): OfferCard[] {
  const slice = orders.slice(0, limit);
  return slice.map((raw, i) => {
    const id = orderId(raw, i);
    const s = JSON.stringify(raw);
    return {
      id,
      title: `Akash open order #${i + 1}`,
      gpu: pickGpuHint(s),
      price: pickPrice(s, raw),
      badge: "Akash mesh",
      slots: 1,
    };
  });
}
