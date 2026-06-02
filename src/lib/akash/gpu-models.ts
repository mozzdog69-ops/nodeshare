export type ProviderGpuModel = {
  vendor: string;
  model: string;
  ram?: string;
  interface?: string;
};

/** rtx4060ti → RTX 4060 Ti, a100 → A100 */
export function formatGpuModelName(model: string): string {
  const raw = model.trim().toLowerCase();
  if (!raw || raw === "*" || raw === "any") return "";

  if (raw.startsWith("rtx")) {
    const rest = raw.slice(3);
    const m = rest.match(/^(\d{4})(ti|super)?$/i);
    if (m) return `RTX ${m[1]}${m[2] ? ` ${m[2].toUpperCase()}` : ""}`;
    return `RTX ${rest.toUpperCase()}`;
  }
  if (raw.startsWith("gtx")) return raw.toUpperCase();
  if (/^(a100|a10|h100|h200|l40|l40s|t4|p40|p4|mi250)$/i.test(raw)) return raw.toUpperCase();
  if (/^b200$/i.test(raw)) return "B200";
  if (/^b300$/i.test(raw)) return "B300";
  if (raw.startsWith("tesla")) {
    const t = raw.replace(/^tesla/, "").toUpperCase();
    return t ? `Tesla ${t}` : "Tesla";
  }
  return raw.toUpperCase();
}

export function formatVendorLabel(vendor: string): string {
  const v = vendor.trim().toLowerCase();
  if (v === "nvidia") return "NVIDIA";
  if (v === "amd") return "AMD";
  return vendor.trim().toUpperCase();
}

export function formatProviderGpuModel(m: ProviderGpuModel): string {
  const name = formatGpuModelName(m.model);
  if (!name) return "";
  const vendor = formatVendorLabel(m.vendor);
  const base = name.startsWith(vendor) ? name : `${vendor} ${name}`;
  return m.ram ? `${base} · ${m.ram}` : base;
}

/** Human label for provider inventory (Console API / GPU catalog). */
export function formatProviderGpuInventory(models: ProviderGpuModel[], max = 2): string {
  const parts = models
    .map(formatProviderGpuModel)
    .filter(Boolean)
    .slice(0, max);
  if (models.length > max) parts.push(`+${models.length - max} more`);
  return parts.join(" · ");
}

export function isGenericGpuLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (/^(\d+\s*)?gpu$/i.test(t)) return true;
  if (/open model bid/i.test(t)) return true;
  if (/any model/i.test(t)) return true;
  if (/^NVIDIA GPU$/i.test(t)) return true;
  if (/^AMD GPU$/i.test(t)) return true;
  // "NVIDIA GPU · open model bid" and similar wildcard bids
  if (/^NVIDIA GPU\b/i.test(t) && !/\b(RTX|GTX|A100|A10|H100|H200|L40|Tesla|T4|P40|P4|4090|3090|4080|6000|B200|B300|MI250)\b/i.test(t)) {
    return true;
  }
  return false;
}

/** Best display name: named bid → else provider Console inventory → else bid text. */
export function resolveOfferGpuHeadline(
  bidLabel: string,
  providerModels?: ProviderGpuModel[],
): { headline: string; inventoryDetail: string | null } {
  const fromBid = bidLabel.trim();
  if (fromBid && !isGenericGpuLabel(fromBid)) {
    return { headline: fromBid, inventoryDetail: null };
  }

  if (providerModels?.length) {
    const primary = formatProviderGpuModel(providerModels[0]);
    if (primary) {
      const inventoryDetail =
        providerModels.length > 1
          ? formatProviderGpuInventory(providerModels, 4)
          : null;
      return { headline: primary, inventoryDetail };
    }
  }

  return {
    headline: fromBid || "GPU compute",
    inventoryDetail: null,
  };
}

/** Parse Akash bid GPU attribute keys (v1beta5: vendor/nvidia/model/*). */
export function labelFromGpuAttributeKey(key: string, value: string): string {
  const k = key.trim();
  const v = value.trim();
  if (!k) return "";

  const cap = k.match(/capabilities\/gpu\/vendor\/([^/]+)\/model\/([^/]+)/i);
  if (cap) {
    const vendor = formatVendorLabel(cap[1]);
    const model = cap[2];
    if (model === "*" || model === "any") return `${vendor} GPU · open model bid`;
    const name = formatGpuModelName(model);
    return name ? `${vendor} ${name}` : `${vendor} GPU`;
  }

  const vendorModel = k.match(/^vendor\/([^/]+)\/model\/(.+)$/i);
  if (vendorModel) {
    const vendor = formatVendorLabel(vendorModel[1]);
    const model = vendorModel[2];
    if (model === "*" || model === "any" || /^\*+$/.test(model)) {
      return `${vendor} GPU · open model bid`;
    }
    const name = formatGpuModelName(model.replace(/\*/g, ""));
    return name ? `${vendor} ${name}` : `${vendor} GPU`;
  }

  const modelInKey = k.match(/model\/([^/]+)/i)?.[1];
  if (modelInKey && modelInKey !== "*" && modelInKey !== "any") {
    const name = formatGpuModelName(modelInKey.replace(/\*/g, ""));
    if (name) return `NVIDIA ${name}`;
  }

  if (/vendor\/nvidia|nvidia/i.test(k)) {
    if (v && v !== "true" && !/^\*+$/.test(v)) {
      const name = formatGpuModelName(v);
      return name ? `NVIDIA ${name}` : `NVIDIA ${v}`;
    }
    return "NVIDIA GPU · open model bid";
  }

  if (/vendor\/amd|amd/i.test(k)) {
    if (v && v !== "true") {
      const name = formatGpuModelName(v);
      return name ? `AMD ${name}` : "AMD GPU";
    }
    return "AMD GPU · open model bid";
  }

  return "";
}
