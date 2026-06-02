import type { GpuOffer } from "@/lib/gpu/types";
import { PAYMENT_ASSET } from "@/lib/gpu/quote-utils";

/** Catalog rows that accept AKT checkout (NodeShare wallet balance). */
export function offerAcceptsAktPayment(offer: GpuOffer): boolean {
  const assets = offer.payment_assets;
  if (!Array.isArray(assets) || assets.length === 0) return true;
  return assets.some((a) => String(a).toUpperCase() === PAYMENT_ASSET);
}

export function filterAktPayableOffers(offers: GpuOffer[]): GpuOffer[] {
  return offers.filter(offerAcceptsAktPayment);
}
