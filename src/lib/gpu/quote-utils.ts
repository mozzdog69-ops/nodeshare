import type { GpuOffer, GpuQuotePreview } from "@/lib/gpu/types";
import { aktBurnForActMint, getAktUsdEstimate } from "@/lib/akash/akt-price";
import { UACT_PER_ACT, UAKT_PER_AKT } from "@/lib/akash/chain-config";
import { lookupReferenceUsdHourly } from "@/lib/akash/gpu-reference-pricing";
import { estimateBurnUaktForMintAmount, estimateDepositUact, estimateDirectRentWalletUakt, estimateMintUactForWallet } from "@/lib/akash/gpu-sdl";

export const PAYMENT_ASSET = "AKT" as const;

export { getAktUsdEstimate };

export function usdHourlyToAkt(usdPerHour: number): number {
  if (!Number.isFinite(usdPerHour) || usdPerHour <= 0) return 0;
  return usdPerHour / getAktUsdEstimate();
}

export function resolveCheckoutHourlyAkt(input: {
  priceHourly?: string | null;
  basePriceAkt?: number;
  basePriceUsd?: number;
  offerBasePrice?: number;
  gpuLabel?: string | null;
}): { hourlyAkt: number; source: "akt" | "usd" | "reference" | "default" } {
  const fromParam = parseHourlyAkt(input.priceHourly ?? null);
  if (fromParam && fromParam > 0) return { hourlyAkt: fromParam, source: "akt" };
  if (input.basePriceAkt && input.basePriceAkt > 0) {
    return { hourlyAkt: input.basePriceAkt, source: "akt" };
  }
  if (input.offerBasePrice && input.offerBasePrice > 0) {
    return { hourlyAkt: input.offerBasePrice, source: "akt" };
  }

  const fromUsdParam = parseHourlyUsd(input.priceHourly ?? null);
  const usd =
    (fromUsdParam && fromUsdParam > 0 ? fromUsdParam : 0) ||
    (input.basePriceUsd && input.basePriceUsd > 0 ? input.basePriceUsd : 0);
  if (usd > 0) {
    const converted = usdHourlyToAkt(usd);
    if (converted > 0) return { hourlyAkt: converted, source: "usd" };
  }

  const refUsd = lookupReferenceUsdHourly(input.gpuLabel ?? "");
  if (refUsd && refUsd > 0) {
    return { hourlyAkt: usdHourlyToAkt(refUsd), source: "reference" };
  }

  return { hourlyAkt: 0.05, source: "default" };
}

/** On-chain deployment escrow in ACT (post-BME). Includes AKT→ACT conversion cost. */
export function directEscrowDepositAkt(hours: string | number, hourlyAkt: number): number {
  const depositUact = Number(estimateDepositUact(Number(hours) || 1, hourlyAkt));
  return depositUact / UACT_PER_ACT;
}

/** ACT minted via BME for this rental (0 if wallet already has enough ACT). */
export function directEscrowMintAct(
  hours: string | number,
  hourlyAkt: number,
  existingAct = 0,
): number {
  const depositUact = estimateDepositUact(Number(hours) || 1, hourlyAkt);
  const existingUact = Math.max(0, existingAct) * UACT_PER_ACT;
  return Number(estimateMintUactForWallet(depositUact, existingUact)) / UACT_PER_ACT;
}

/** Whole AKT required in wallet (BME burn + on-chain gas). */
export function directEscrowBurnAkt(
  hours: string | number,
  hourlyAkt: number,
  existingAct = 0,
  aktUsd = getAktUsdEstimate(),
): number {
  const depositUact = estimateDepositUact(Number(hours) || 1, hourlyAkt);
  const existingUact = Math.max(0, existingAct) * UACT_PER_ACT;
  return Number(estimateDirectRentWalletUakt(depositUact, existingUact, aktUsd)) / UAKT_PER_AKT;
}

/** AKT burned in the BME mint tx only (excludes gas). */
export function directEscrowMintBurnAkt(
  hours: string | number,
  hourlyAkt: number,
  existingAct = 0,
  aktUsd = getAktUsdEstimate(),
): number {
  const depositUact = estimateDepositUact(Number(hours) || 1, hourlyAkt);
  const existingUact = Math.max(0, existingAct) * UACT_PER_ACT;
  const mintUact = estimateMintUactForWallet(depositUact, existingUact);
  return Number(estimateBurnUaktForMintAmount(mintUact, aktUsd)) / UAKT_PER_AKT;
}

/** AKT equivalent of the escrow deposit only (excludes one-time BME mint). */
export function directEscrowDepositAktEquivalent(
  hours: string | number,
  hourlyAkt: number,
  aktUsd = getAktUsdEstimate(),
): number {
  const depositAct = directEscrowDepositAkt(hours, hourlyAkt);
  return aktBurnForActMint(depositAct, aktUsd);
}

export function formatActDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const s =
    amount < 0.0001 ? amount.toFixed(8) : amount < 0.01 ? amount.toFixed(6) : amount.toFixed(4);
  return `${s} ACT`;
}

export function quoteTotalAktNumber(
  preview: GpuQuotePreview | null,
  hours: string | number,
  offer: GpuOffer | null,
  basePriceAktFallback = 0,
): number {
  const raw =
    preview?.quote?.total_amount ??
    preview?.quote?.totalAmount ??
    preview?.total;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const h = Math.max(1, Number(hours || 1));
  const base =
    Number(
      (offer as GpuOffer & { base_price_akt?: number })?.base_price_akt ??
        offer?.base_price ??
        basePriceAktFallback ??
        0,
    ) * h;
  if (base <= 0) return 0;
  return base + base * 0.25 + 0.05;
}

export function breakdownLineItemsSumAkt(
  lineItems: GpuQuotePreview["line_items"],
): number | null {
  if (!lineItems || typeof lineItems !== "object") return null;
  const sum =
    Number(lineItems.provider_base_cost ?? 0) +
    Number(lineItems.platform_fee ?? 0) +
    Number(lineItems.network_fee_estimate ?? 0) +
    Number(lineItems.tax_amount ?? 0);
  return Number.isFinite(sum) ? sum : null;
}

/** uakt uses 6 decimals — trim trailing zeros for human pay amount. */
export function formatAktPayAmount(totalNum: number): string {
  if (!Number.isFinite(totalNum) || totalNum <= 0) return "";
  let s = Number(totalNum).toFixed(6);
  s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return s || "";
}

export function parseHourlyAkt(hourlyEstimate: string | null): number | null {
  if (!hourlyEstimate) return null;
  const m = hourlyEstimate.match(/~?\s*([\d.]+)\s*AKT/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** @deprecated LCD USDC hourly — kept for display only */
export function parseHourlyUsd(hourlyEstimate: string | null): number | null {
  if (!hourlyEstimate) return null;
  const m = hourlyEstimate.match(/\$([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildCheckoutSearchParams(input: {
  offerId: string;
  title: string;
  provider?: string;
  basePriceAkt?: number | null;
  basePriceUsd?: number | null;
  gpuLabel?: string;
  gpuModelSlug?: string;
  gpuVram?: string;
  gpuInterface?: string;
  /** LCD open-bid reference (dseq-gseq-oseq) when checkout uses catalog offer id */
  lcdOrderId?: string;
  providerOwner?: string;
  providerOnline?: boolean;
  /** Console stats: host has free GPU slots. */
  gpuHasCapacity?: boolean;
  fastRentEligible?: boolean;
  priceHourly?: string | null;
  pricePerBlock?: string | null;
  lcdPriceAmount?: string | null;
  lcdPriceDenom?: string | null;
}): string {
  const params = new URLSearchParams({
    offerId: input.offerId,
    gpu: input.gpuLabel || input.title,
    region: "Global",
    provider: input.provider || "Akash",
    basePriceAkt: String(Number(input.basePriceAkt || 0)),
  });
  if (input.lcdOrderId) params.set("lcdOrderId", input.lcdOrderId);
  if (input.providerOwner) params.set("providerOwner", input.providerOwner);
  if (input.gpuModelSlug) params.set("gpuSlug", input.gpuModelSlug);
  if (input.gpuVram) params.set("gpuVram", input.gpuVram);
  if (input.gpuInterface) params.set("gpuInterface", input.gpuInterface);
  if (input.basePriceUsd != null && Number(input.basePriceUsd) > 0) {
    params.set("basePriceUsd", String(input.basePriceUsd));
  }
  if (input.priceHourly) params.set("priceHourly", input.priceHourly);
  if (input.pricePerBlock) params.set("pricePerBlock", input.pricePerBlock);
  if (input.lcdPriceAmount) params.set("lcdPriceAmount", input.lcdPriceAmount);
  if (input.lcdPriceDenom) params.set("lcdPriceDenom", input.lcdPriceDenom);
  if (input.providerOnline === false) params.set("providerOnline", "0");
  if (input.providerOnline === true) params.set("providerOnline", "1");
  if (input.gpuHasCapacity === false) params.set("gpuCapacity", "0");
  if (input.gpuHasCapacity === true) params.set("gpuCapacity", "1");
  if (input.fastRentEligible === false) params.set("fastRent", "0");
  if (input.fastRentEligible === true) params.set("fastRent", "1");
  return params.toString();
}

/** Illustrative runtime total from LCD hourly string (USDC or AKT). */
export function lcdHourlyTotalLabel(
  priceHourly: string | null | undefined,
  hours: string | number,
): string | null {
  const h = Math.max(1, Number(hours || 1));
  const raw = String(priceHourly || "").trim();
  if (!raw) return null;
  const usd = raw.match(/\$([\d.]+)/);
  if (usd) {
    const n = Number(usd[1]) * h;
    if (Number.isFinite(n) && n > 0) {
      return `~$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)} (est.)`;
    }
  }
  const akt = raw.match(/([\d.]+)\s*AKT/i);
  if (akt) {
    const n = Number(akt[1]) * h;
    if (Number.isFinite(n) && n > 0) {
      return formatAktDisplay(n).replace(" AKT", " AKT (est.)");
    }
  }
  return null;
}

export function formatAktDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const s = amount < 0.0001 ? amount.toFixed(8) : amount < 0.01 ? amount.toFixed(6) : amount.toFixed(4);
  return `${s} AKT`;
}

/** How much more AKT the wallet needs (0 if sufficient). */
export function aktTopUpNeeded(required: number, balance: number | null | undefined): number {
  if (balance == null || !Number.isFinite(required) || required <= 0) return 0;
  return Math.max(0, required - balance);
}
