import type { GpuOffer } from "@/lib/gpu/types";

const LCD_ORDER_ID = /^\d+-\d+-\d+$/;

export function isLcdAkashOrderId(id: string): boolean {
  return LCD_ORDER_ID.test(String(id || "").trim());
}

export function parseLcdAkashOrderId(id: string): {
  dseq: string;
  gseq: string;
  oseq: string;
} | null {
  const m = String(id || "")
    .trim()
    .match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  return { dseq: m[1], gseq: m[2], oseq: m[3] };
}

function normalizeGpuLabel(label: string): string {
  return String(label || "")
    .toLowerCase()
    .replace(/nvidia\s+/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function gpuLabelsMatch(a: string, b: string): boolean {
  const na = normalizeGpuLabel(a);
  const nb = normalizeGpuLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  const tokensA = na.split(/\s+/).filter((t) => t.length >= 2);
  const tokensB = new Set(nb.split(/\s+/).filter((t) => t.length >= 2));
  return tokensA.some((t) => tokensB.has(t));
}

export type ResolvedBackendOffer =
  | {
      ok: true;
      checkoutOfferId: string;
      offer: GpuOffer;
      mode: "exact" | "gpu_match" | "single_catalog";
      lcdOrderId?: string;
    }
  | {
      ok: false;
      lcdOrderId?: string;
      requestedId: string;
      reason: "lcd_only" | "not_in_catalog";
    };

export function resolveBackendOffer(input: {
  requestedId: string;
  backendOffers: GpuOffer[];
  gpuLabel?: string;
}): ResolvedBackendOffer {
  const requestedId = String(input.requestedId || "").trim();
  const lcdOrderId = isLcdAkashOrderId(requestedId) ? requestedId : undefined;

  if (!requestedId) {
    return { ok: false, requestedId: "", reason: "not_in_catalog", lcdOrderId };
  }

  const exact = input.backendOffers.find((o) => o.id === requestedId);
  if (exact) {
    return {
      ok: true,
      checkoutOfferId: exact.id,
      offer: exact,
      mode: "exact",
      lcdOrderId,
    };
  }

  const gpuHint = String(input.gpuLabel || "").trim();
  if (gpuHint && !/^1\s*gpu$/i.test(gpuHint) && !/^compute$/i.test(gpuHint)) {
    const byGpu = input.backendOffers.find((o) => {
      const catalog = o.gpu_model || o.gpu || o.title || "";
      return gpuLabelsMatch(gpuHint, catalog);
    });
    if (byGpu) {
      return {
        ok: true,
        checkoutOfferId: byGpu.id,
        offer: byGpu,
        mode: "gpu_match",
        lcdOrderId,
      };
    }
  }

  if (lcdOrderId && input.backendOffers.length === 1) {
    const only = input.backendOffers[0];
    return {
      ok: true,
      checkoutOfferId: only.id,
      offer: only,
      mode: "single_catalog",
      lcdOrderId,
    };
  }

  if (lcdOrderId) {
    return { ok: false, requestedId, lcdOrderId, reason: "lcd_only" };
  }

  return { ok: false, requestedId, lcdOrderId, reason: "not_in_catalog" };
}
