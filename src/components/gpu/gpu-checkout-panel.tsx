"use client";

import { AktCheckoutPayment } from "@/components/gpu/akt-checkout-payment";
import { GpuOfferPreview } from "@/components/gpu/gpu-offer-preview";
import { NodeShareAktWalletCard } from "@/components/wallet/nodeshare-akt-wallet-card";
import { useWalletSession } from "@/context/wallet-session";
import { useLiveAktBalance } from "@/hooks/use-live-akt-balance";
import { useLiveAktUsd } from "@/hooks/use-live-akt-usd";
import { useAkashGpuCatalog } from "@/hooks/use-akash-gpu-catalog";
import { useGpuBackendStatus } from "@/hooks/use-gpu-backend-status";
import { buildAkashConsoleDeployUrl } from "@/lib/akash/console-links";
import { ActCreditsBanner } from "@/components/gpu/act-credits-banner";
import { DirectAkashRentTracker } from "@/components/gpu/direct-akash-rent-tracker";
import { GpuRentWaitBadge } from "@/components/gpu/gpu-rent-wait-badge";
import { estimateRentWait } from "@/lib/akash/rent-wait-estimate";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import {
  closeOpenAkashDeployments,
  directAkashGpuRent,
  MANIFEST_FETCH_USER_MESSAGE,
  RENT_BID_TIMEOUT_USER_MESSAGE,
  resumeDirectAkashGpuRent,
  retryDirectAkashManifest,
  type DirectRentProgressSnapshot,
} from "@/lib/akash/direct-rent";
import { isBidDeploymentMismatchMessage } from "@/lib/akash/fetch-lease-info";
import { isNonRetryableManifestError } from "@/lib/akash/send-manifest";
import { createInitialRentProgress } from "@/lib/akash/direct-rent-steps";
import {
  clearDirectRentProgress,
  isRentProgressFailed,
  isRentProgressInFlight,
  readDirectRentProgress,
  saveDirectRentProgress,
} from "@/lib/akash/direct-rent-progress-storage";
import { readRentManifestJsonForDseq } from "@/lib/gpu/job-storage";
import { isGenericGpuLabel } from "@/lib/akash/gpu-models";
import { resolveAkashGpuModelSlug } from "@/lib/akash/gpu-reference-pricing";
import { sendAktFromMnemonic } from "@/lib/akash/send-akt";
import { getAkashChainId, getGpuAktTreasury, BME_MIN_MINT_UACT, UACT_PER_ACT } from "@/lib/akash/chain-config";
import {
  PAYMENT_ASSET,
  breakdownLineItemsSumAkt,
  directEscrowBurnAkt,
  directEscrowDepositAkt,
  directEscrowDepositAktEquivalent,
  directEscrowMintAct,
  directEscrowMintBurnAkt,
  formatActDisplay,
  formatAktDisplay,
  formatAktPayAmount,
  getAktUsdEstimate,
  lcdHourlyTotalLabel,
  quoteTotalAktNumber,
  resolveCheckoutHourlyAkt,
  aktTopUpNeeded,
} from "@/lib/gpu/quote-utils";
import { friendlyRpcError } from "@/lib/chain/rpc-url";
import { fetchApiJson } from "@/lib/fetch-api";
import { offerAcceptsAktPayment } from "@/lib/gpu/akt-payment";
import {
  confirmGpuPayment,
  createGpuJob,
  createGpuQuote,
  fetchGpuJobById,
} from "@/lib/gpu/gpu-power-service";
import { signingWalletFromIdentity } from "@/lib/gpu/gpu-wallet";
import { isLcdAkashOrderId, resolveBackendOffer } from "@/lib/gpu/resolve-backend-offer";
import { markAkashDseqJobs, upsertGlobalGpuJob, upsertLocalGpuJob } from "@/lib/gpu/job-storage";
import type { GpuOffer, GpuQuotePreview } from "@/lib/gpu/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CheckoutMode = "direct" | "provisioner";

function buildLcdSyntheticOffer(input: {
  lcdReferenceId: string;
  offerId: string;
  offerGpu: string;
  offerRegion: string;
  offerProvider: string;
  offerBasePriceAkt: number;
}): GpuOffer {
  return {
    id: input.lcdReferenceId || input.offerId || "lcd-offer",
    gpu_model: input.offerGpu || "Akash GPU compute",
    region: input.offerRegion,
    provider_name: input.offerProvider,
    base_price: Number.isFinite(input.offerBasePriceAkt) ? input.offerBasePriceAkt : 0,
    category: "SSH GPU",
    ssh_access: true,
  };
}

function pickProvisionerOfferId(input: {
  offerId: string;
  lcdReferenceId: string;
  backendOffers: GpuOffer[];
  gpuLabel: string;
}): { checkoutOfferId: string; resolved: ReturnType<typeof resolveBackendOffer> } {
  const requestedId = input.offerId.trim();
  const resolved = resolveBackendOffer({
    requestedId: requestedId || input.lcdReferenceId,
    backendOffers: input.backendOffers,
    gpuLabel: input.gpuLabel,
  });
  if (resolved.ok) {
    return { checkoutOfferId: resolved.checkoutOfferId, resolved };
  }
  const fallback = input.backendOffers[0];
  if (fallback?.id) {
    return { checkoutOfferId: fallback.id, resolved };
  }
  return { checkoutOfferId: requestedId || input.lcdReferenceId, resolved };
}

export function GpuCheckoutPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { identity, aktAddress, ethAddress } = useWalletSession();
  const aktWallet = useLiveAktBalance();
  const { aktUsd, source: aktUsdSource } = useLiveAktUsd();
  const { hasSufficientAkt, refresh: refreshAktBalance, walletReady, aktFormatted, aktBalance, actBalance, actFormatted } =
    aktWallet;

  const { configured: backendConfigured, loading: backendStatusLoading } = useGpuBackendStatus();
  const catalog = useAkashGpuCatalog({ enabled: backendConfigured });

  const offerId = searchParams.get("offerId") || "";
  const lcdOrderIdParam = searchParams.get("lcdOrderId") || "";
  const providerOwner = searchParams.get("providerOwner") || "";
  const offerGpu = searchParams.get("gpu") || "";
  const gpuModelSlug = searchParams.get("gpuSlug") || "";
  const gpuVram = searchParams.get("gpuVram") || "";
  const gpuInterface = searchParams.get("gpuInterface") || "";
  const offerRegion = searchParams.get("region") || "Global";
  const offerProvider = searchParams.get("provider") || "Akash";
  const offerBasePriceAkt = Number(searchParams.get("basePriceAkt") || 0);
  const offerBasePriceUsd = Number(searchParams.get("basePriceUsd") || 0);
  const priceHourlyParam = searchParams.get("priceHourly") || "";
  const pricePerBlockParam = searchParams.get("pricePerBlock") || "";
  const lcdPriceAmountParam = searchParams.get("lcdPriceAmount") || "";
  const lcdPriceDenomParam = searchParams.get("lcdPriceDenom") || "";
  const providerOnlineParam = searchParams.get("providerOnline");
  const catalogProviderOnline = providerOnlineParam !== "0";
  const gpuCapacityParam = searchParams.get("gpuCapacity");
  const catalogHasGpuCapacity = gpuCapacityParam !== "0";
  const fastRentParam = searchParams.get("fastRent");
  const catalogFastRent = fastRentParam !== "0";

  const catalogModelSlug = useMemo(
    () =>
      resolveAkashGpuModelSlug({
        gpuModelSlug: gpuModelSlug || undefined,
        gpuLabel: offerGpu || undefined,
      }),
    [gpuModelSlug, offerGpu],
  );

  const catalogPick = useMemo(
    () =>
      providerOwner && catalogProviderOnline && catalogHasGpuCapacity && catalogModelSlug
        ? { providerOwner, gpuModelSlug: catalogModelSlug }
        : null,
    [providerOwner, catalogProviderOnline, catalogHasGpuCapacity, catalogModelSlug],
  );

  const [checkoutOfferId, setCheckoutOfferId] = useState("");
  const [resolveNotice, setResolveNotice] = useState("");
  const [providerRentWarn, setProviderRentWarn] = useState("");
  const [rentBlocked, setRentBlocked] = useState(false);
  const [rentBlockReason, setRentBlockReason] = useState("");
  const [marketActiveProvider, setMarketActiveProvider] = useState(false);
  const [offer, setOffer] = useState<GpuOffer | null>(null);
  const [hours, setHours] = useState("1");
  const [renting, setRenting] = useState(false);
  const [releasingStuck, setReleasingStuck] = useState(false);
  const [completingPending, setCompletingPending] = useState(false);
  const [retryingManifest, setRetryingManifest] = useState(false);
  const [rentProgress, setRentProgress] = useState<DirectRentProgressSnapshot | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [lastJobId, setLastJobId] = useState("");
  const [offerLoading, setOfferLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quotePreview, setQuotePreview] = useState<GpuQuotePreview | null>(null);

  const lcdReferenceId =
    lcdOrderIdParam || (isLcdAkashOrderId(offerId) ? offerId : "");

  const checkoutMode = useMemo((): CheckoutMode => {
    if (searchParams.get("mode") === "provisioner" && backendConfigured) return "provisioner";
    return "direct";
  }, [backendConfigured, searchParams]);

  const consoleUrl = useMemo(
    () =>
      buildAkashConsoleDeployUrl({
        lcdOrderId: lcdReferenceId,
        providerOwner,
      }),
    [lcdReferenceId, providerOwner],
  );

  const { hourlyAkt, source: hourlySource } = useMemo(
    () =>
      resolveCheckoutHourlyAkt({
        priceHourly: priceHourlyParam,
        basePriceAkt: offerBasePriceAkt,
        basePriceUsd: offerBasePriceUsd,
        offerBasePrice: Number(offer?.base_price ?? 0),
        gpuLabel: offerGpu,
      }),
    [priceHourlyParam, offerBasePriceAkt, offerBasePriceUsd, offer?.base_price, offerGpu],
  );

  const existingAct = actBalance ?? 0;

  const directDepositAct = useMemo(
    () => directEscrowDepositAkt(hours, hourlyAkt),
    [hourlyAkt, hours],
  );
  const directDepositAktEq = useMemo(
    () => directEscrowDepositAktEquivalent(hours, hourlyAkt, aktUsd),
    [hourlyAkt, hours, aktUsd],
  );
  const directMintAct = useMemo(
    () => directEscrowMintAct(hours, hourlyAkt, existingAct),
    [hourlyAkt, hours, existingAct],
  );
  const directMintBurnAkt = useMemo(
    () => directEscrowMintBurnAkt(hours, hourlyAkt, existingAct, aktUsd),
    [hourlyAkt, hours, existingAct, aktUsd],
  );
  const directBurnAkt = useMemo(
    () => directEscrowBurnAkt(hours, hourlyAkt, existingAct, aktUsd),
    [hourlyAkt, hours, existingAct, aktUsd],
  );
  const needsBmeMint = directMintAct > 0;
  const isFirstTimeMint =
    needsBmeMint && directMintAct >= BME_MIN_MINT_UACT / UACT_PER_ACT - 0.001;
  const leftoverAct = needsBmeMint ? Math.max(0, directMintAct - directDepositAct) : 0;
  const aktTopUp = aktTopUpNeeded(directBurnAkt, aktBalance);

  const genericGpuOffer = useMemo(
    () => isGenericGpuLabel(offerGpu || offer?.gpu_model || ""),
    [offerGpu, offer?.gpu_model],
  );

  const lcdRuntimeTotal = useMemo(
    () => lcdHourlyTotalLabel(priceHourlyParam, hours),
    [priceHourlyParam, hours],
  );

  useEffect(() => {
    if (checkoutMode !== "direct" || !aktAddress) return;
  const syncSavedRentProgress = async () => {
    const saved = readDirectRentProgress(aktAddress);
    if (!saved) return;

    let progress = saved;
    if (saved.dseq != null) {
      const stuckGot = await fetchApiJson<{
        ok: boolean;
        data?: { items?: { dseq: number }[] };
      }>(`/api/akash/stuck-deployments?address=${encodeURIComponent(aktAddress)}`);
      const stuck = stuckGot.ok ? (stuckGot.body.data?.items ?? []) : [];
      const active = new Set(stuck.map((s) => s.dseq));
      if (!active.has(saved.dseq) && stuck.length > 0) {
        const latest = stuck[0]!.dseq;
        progress = {
          ...saved,
          dseq: latest,
          message: `Deployment ${latest} active — continuing bid wait…`,
        };
        saveDirectRentProgress(aktAddress, progress);
      } else if (!active.has(saved.dseq) && stuck.length === 0 && isRentProgressInFlight(saved)) {
        clearDirectRentProgress(aktAddress);
        return;
      }
    }

    if (progress && isRentProgressFailed(progress)) {
      if (progress.failedStep === "provider_bids" && progress.dseq != null) {
        setRentProgress(progress);
        setError(RENT_BID_TIMEOUT_USER_MESSAGE);
      } else if (progress.failedStep === "manifest" && progress.dseq != null) {
        setRentProgress(progress);
        setError(MANIFEST_FETCH_USER_MESSAGE);
      } else {
        clearDirectRentProgress(aktAddress);
      }
      return;
    }
    if (progress && isRentProgressInFlight(progress)) {
      setRentProgress(progress);
    }
  };

    void syncSavedRentProgress();
  }, [aktAddress, checkoutMode]);

  useEffect(() => {
    if (checkoutMode !== "direct" || genericGpuOffer) return;
    let dead = false;
    void (async () => {
      try {
        const { resolveRentProviderTarget } = await import("@/lib/akash/pick-rent-provider");
        const target = await resolveRentProviderTarget({
          gpuModelSlug: catalogModelSlug || gpuModelSlug || undefined,
          gpuLabel: offerGpu || offer?.gpu_model,
          preferredOwner: providerOwner || undefined,
          catalogPick,
        });
        if (!dead) {
          setResolveNotice(target.summary);
          setProviderRentWarn(target.warn ?? "");
          setRentBlocked(Boolean(target.rentBlocked));
          setRentBlockReason(target.blockReason ?? target.warn ?? "");
        }
      } catch {
        if (!dead) {
          setResolveNotice(
            providerOwner
              ? "Rent prefers your marketplace provider — open deployment, matching bids in ~30–90s."
              : "Pick a GPU from the marketplace catalog for instant provider matching.",
          );
          setProviderRentWarn("");
          setRentBlocked(false);
          setRentBlockReason("");
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [
    checkoutMode,
    genericGpuOffer,
    catalogModelSlug,
    gpuModelSlug,
    offerGpu,
    offer?.gpu_model,
    providerOwner,
    catalogPick,
    catalogProviderOnline,
  ]);

  useEffect(() => {
    if (checkoutMode !== "direct" || !providerOwner) {
      setMarketActiveProvider(false);
      return;
    }
    let dead = false;
    void (async () => {
      try {
        const { marketActiveProvidersFromOrders } = await import("@/lib/akash/rent-wait-estimate");
        const got = await fetchApiJson<{
          ok: boolean;
          data?: { orders?: unknown[]; providersByOwner?: Record<string, unknown> };
        }>("/api/akash/market?limit=40");
        if (!got.ok || !got.body.ok || dead) return;
        const active = marketActiveProvidersFromOrders(
          got.body.data?.orders ?? [],
          got.body.data?.providersByOwner as Record<string, import("@/lib/akash/gpu-models").ProviderGpuModel[]>,
        );
        if (!dead) setMarketActiveProvider(active.has(providerOwner.toLowerCase()));
      } catch {
        if (!dead) setMarketActiveProvider(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [checkoutMode, providerOwner]);

  const rentWaitEstimate = useMemo(
    () =>
      checkoutMode === "direct"
        ? estimateRentWait({
            isOnline: catalogProviderOnline,
            hasGpuCapacity: catalogHasGpuCapacity,
            hasLcdSpot: Boolean(pricePerBlockParam || lcdReferenceId),
            providerOwner,
            marketActive: marketActiveProvider,
            needsMint: needsBmeMint,
          })
        : null,
    [
      checkoutMode,
      catalogProviderOnline,
      catalogHasGpuCapacity,
      pricePerBlockParam,
      lcdReferenceId,
      providerOwner,
      marketActiveProvider,
      needsBmeMint,
    ],
  );

  const providerOfflineBlock =
    checkoutMode === "direct" &&
    providerOwner &&
    !catalogProviderOnline;

  const providerFullyBookedBlock =
    checkoutMode === "direct" &&
    providerOwner &&
    catalogProviderOnline &&
    !catalogHasGpuCapacity;

  const slowRentWarn =
    checkoutMode === "direct" && providerOwner && catalogProviderOnline && !catalogFastRent;

  useEffect(() => {
    if (backendStatusLoading) {
      setOfferLoading(true);
      return;
    }

    const synthetic = buildLcdSyntheticOffer({
      lcdReferenceId,
      offerId,
      offerGpu,
      offerRegion,
      offerProvider,
      offerBasePriceAkt: hourlyAkt || offerBasePriceAkt,
    });

    if (checkoutMode === "direct") {
      setOfferLoading(false);
      setCheckoutOfferId(lcdReferenceId || offerId);
      setResolveNotice(
        providerOwner
          ? "Direct rent — locked to your chosen provider for fast bids."
          : "Loading provider match…",
      );
      setOffer(synthetic);
      return;
    }

    if (catalog.loading) {
      setCheckoutOfferId(lcdReferenceId || offerId);
      setOffer(synthetic);
      setResolveNotice("");
      setOfferLoading(false);
      return;
    }

    setOfferLoading(true);
    setResolveNotice("");

    const { checkoutOfferId: pickedId, resolved } = pickProvisionerOfferId({
      offerId,
      lcdReferenceId,
      backendOffers: catalog.offers,
      gpuLabel: offerGpu,
    });

    const catalogOffer = catalog.offers.find((o) => o.id === pickedId) || null;

    if (catalogOffer && !offerAcceptsAktPayment(catalogOffer)) {
      setCheckoutOfferId("");
      setOffer(catalogOffer);
      setResolveNotice(
        "This catalog offer does not accept AKT — use direct Akash rent or Akash Console.",
      );
      setOfferLoading(false);
      return;
    }

    setCheckoutOfferId(pickedId || lcdReferenceId || offerId);

    if (catalogOffer) {
      setOffer({
        ...catalogOffer,
        gpu_model:
          catalogOffer.gpu_model || offerGpu || catalogOffer.title || "GPU compute",
        region: catalogOffer.region || offerRegion,
        provider_name: catalogOffer.provider_name || offerProvider,
        base_price:
          Number(catalogOffer.base_price) > 0
            ? Number(catalogOffer.base_price)
            : Number.isFinite(offerBasePriceAkt)
              ? offerBasePriceAkt
              : 0,
      });
    } else {
      setOffer(synthetic);
      setResolveNotice("Provisioner mode — backend catalog empty.");
      setOfferLoading(false);
      return;
    }

    if (resolved.ok && resolved.lcdOrderId && resolved.mode !== "exact") {
      setResolveNotice(`LCD bid ${resolved.lcdOrderId} → catalog offer.`);
    } else if (lcdReferenceId) {
      setResolveNotice(`Akash LCD reference: ${lcdReferenceId}`);
    }

    setOfferLoading(false);
  }, [
    backendStatusLoading,
    checkoutMode,
    catalog.loading,
    catalog.offers,
    offerId,
    offerGpu,
    offerRegion,
    offerProvider,
    offerBasePriceAkt,
    hourlyAkt,
    lcdReferenceId,
    providerOwner,
  ]);

  useEffect(() => {
    setQuotePreview(null);
  }, [offer?.id, hours, identity, checkoutMode]);

  const quoteTotalNum = useMemo(
    () =>
      checkoutMode === "direct"
        ? directBurnAkt
        : quoteTotalAktNumber(quotePreview, hours, offer, offerBasePriceAkt),
    [checkoutMode, directBurnAkt, quotePreview, hours, offer, offerBasePriceAkt],
  );
  const totalLabel = useMemo(
    () =>
      checkoutMode === "direct"
        ? `${formatActDisplay(directDepositAct)} (~${formatAktDisplay(directBurnAkt)} AKT)`
        : formatAktDisplay(quoteTotalNum),
    [checkoutMode, directBurnAkt, directDepositAct, quoteTotalNum],
  );
  const hasLiveQuote = checkoutMode === "direct" ? quoteTotalNum > 0 : Boolean(quotePreview?.quote_id);
  const breakdownSum = useMemo(
    () => breakdownLineItemsSumAkt(quotePreview?.line_items),
    [quotePreview?.line_items],
  );
  const breakdownMismatch =
    checkoutMode === "provisioner" &&
    hasLiveQuote &&
    breakdownSum != null &&
    Math.abs(breakdownSum - quoteTotalNum) > 0.0001;
  const runtimeMinutes = useMemo(
    () => Math.max(15, Math.round(Number(hours || 1) * 60)),
    [hours],
  );

  async function loadLiveQuote() {
    if (!identity?.mnemonic) {
      setError("Unlock your NodeShare wallet to load a live AKT quote.");
      return;
    }
    if (!aktAddress) {
      setError("No Akash address on this wallet.");
      return;
    }
    const selectedOfferId = checkoutOfferId || offer?.id;
    if (!selectedOfferId) {
      setError("Offer is still loading. Please try again.");
      return;
    }
    setQuoteLoading(true);
    setError("");
    setInfo("");
    try {
      const wallet = signingWalletFromIdentity(identity);
      const quoteRes = await createGpuQuote({
        wallet,
        offerId: selectedOfferId,
        estimatedRuntimeMinutes: runtimeMinutes,
        paymentAsset: PAYMENT_ASSET,
        lcdOrderId: lcdReferenceId,
        providerOwner,
      });
      setQuotePreview(quoteRes);
      const total = quoteTotalAktNumber(quoteRes, hours, offer, offerBasePriceAkt);
      setInfo(`Live quote: ${formatAktDisplay(total)} — payable from your NodeShare AKT balance.`);
      void refreshAktBalance();
    } catch (e) {
      setQuotePreview(null);
      setError(e instanceof Error ? e.message : "Could not load live quote.");
    } finally {
      setQuoteLoading(false);
    }
  }

  const hasGpuTarget = Boolean(
    gpuModelSlug || offerGpu || offer?.gpu_model,
  );

  const canPayDirect =
    checkoutMode === "direct" &&
    walletReady &&
    Boolean(identity?.mnemonic) &&
    quoteTotalNum > 0 &&
    hasSufficientAkt(quoteTotalNum) &&
    hasGpuTarget &&
    !providerOfflineBlock &&
    !providerFullyBookedBlock &&
    !rentBlocked;

  const canPayProvisioner =
    checkoutMode === "provisioner" &&
    walletReady &&
    Boolean(identity?.mnemonic) &&
    hasLiveQuote &&
    quoteTotalNum > 0 &&
    hasSufficientAkt(quoteTotalNum) &&
    Boolean(offer && offerAcceptsAktPayment(offer));

  const canPay = checkoutMode === "direct" ? canPayDirect : canPayProvisioner;

  async function handleDirectRent() {
    if (!identity?.mnemonic) {
      setError("Unlock your wallet — AKT is escrowed from your NodeShare Akash address.");
      return;
    }
    if (!aktAddress) {
      setError("No Akash address on this NodeShare wallet.");
      return;
    }
    const burnAkt = directEscrowBurnAkt(hours, hourlyAkt, existingAct, aktUsd);

    try {
      setRenting(true);
      setError("");
      setRentProgress(createInitialRentProgress("Checking wallet balance…"));
      setInfo("");
      await refreshAktBalance();

      if (!hasSufficientAkt(burnAkt)) {
        throw new Error(
          `Not enough AKT (~${formatAktDisplay(burnAkt)} required including BME mint + gas; you have ${aktFormatted ?? formatAktDisplay(aktBalance ?? 0)}). First rentals need enough AKT to mint at least 10 ACT (~$10 worth at current prices).`,
        );
      }

      if (aktAddress) clearDirectRentProgress(aktAddress);

      const result = await directAkashGpuRent({
        mnemonic: identity.mnemonic,
        providerOwner: providerOwner || undefined,
        catalogPick,
        gpuLabel: offer?.gpu_model || offerGpu,
        gpuModelSlug: gpuModelSlug || undefined,
        gpuVram: gpuVram || undefined,
        gpuInterface: gpuInterface || undefined,
        lcdPriceAmount: lcdPriceAmountParam || undefined,
        lcdPriceDenom: lcdPriceDenomParam || undefined,
        hourlyAkt,
        hours: Number(hours || 1),
        aktUsd,
        closeStuckDeploymentsFirst: true,
        title: `Akash ${offer?.gpu_model || offerGpu || "GPU"}`,
        onProgress: (p) => {
          setRentProgress(p);
          setInfo(p.message);
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
        },
      });

      setLastJobId(result.job.id);
      if (aktAddress) clearDirectRentProgress(aktAddress);
      void refreshAktBalance();
      router.push(`/app/gpu/terminal/${encodeURIComponent(result.job.id)}`);
    } catch (e) {
      const msg = friendlyRpcError(e instanceof Error ? e.message : "Direct Akash rent failed.");
      setError(msg);
      setInfo("");
      setRentProgress((p) => {
        if (p?.dseq != null || p?.failedStep) {
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
          if (p?.dseq != null) {
            markAkashDseqJobs([ethAddress || "", aktAddress || ""], p.dseq, {
              internal_status: "failed",
              provider_status:
                p.failedStep === "manifest" || /failed to fetch|manifest upload/i.test(msg)
                  ? "manifest_failed"
                  : "bid_timeout",
              error_message: msg,
            });
          }
          return p;
        }
        if (aktAddress) clearDirectRentProgress(aktAddress);
        return null;
      });
    } finally {
      setRenting(false);
    }
  }

  const pendingBidDseq =
    checkoutMode === "direct" &&
    (rentProgress?.failedStep === "provider_bids" ||
      rentProgress?.failedStep === "accept_lease") &&
    rentProgress.dseq != null
      ? rentProgress.dseq
      : null;

  const pendingManifestDseq =
    checkoutMode === "direct" &&
    rentProgress?.failedStep === "manifest" &&
    rentProgress.dseq != null
      ? rentProgress.dseq
      : null;

  const pendingManifestBidMismatch =
    pendingManifestDseq != null &&
    (isBidDeploymentMismatchMessage(error) ||
      isBidDeploymentMismatchMessage(rentProgress?.message || "") ||
      isBidDeploymentMismatchMessage(rentProgress?.steps.manifest?.detail || ""));

  const pendingManifestNonRetryable =
    pendingManifestDseq != null &&
    (pendingManifestBidMismatch ||
      isNonRetryableManifestError(error) ||
      isNonRetryableManifestError(rentProgress?.message || "") ||
      isNonRetryableManifestError(rentProgress?.steps.manifest?.detail || ""));

  async function handleCompletePendingRent() {
    if (!identity?.mnemonic || pendingBidDseq == null) return;
    try {
      setCompletingPending(true);
      setError("");
      setRentProgress(createInitialRentProgress(`Accepting bids on dseq ${pendingBidDseq}…`));
      const result = await resumeDirectAkashGpuRent({
        mnemonic: identity.mnemonic,
        dseq: pendingBidDseq,
        title: `Akash ${offer?.gpu_model || offerGpu || "GPU"}`,
        hourlyAkt,
        hours: Number(hours || 1),
        gpuLabel: offer?.gpu_model || offerGpu,
        gpuModelSlug: gpuModelSlug || undefined,
        gpuVram: gpuVram || undefined,
        gpuInterface: gpuInterface || undefined,
        openToAnyProvider: true,
        manifestJson: aktAddress
          ? readRentManifestJsonForDseq(aktAddress, pendingBidDseq)
          : undefined,
        onProgress: (p) => {
          setRentProgress(p);
          setInfo(p.message);
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
        },
      });
      if (aktAddress) clearDirectRentProgress(aktAddress);
      void refreshAktBalance();
      router.push(`/app/gpu/terminal/${encodeURIComponent(result.job.id)}`);
    } catch (e) {
      const msg = friendlyRpcError(e instanceof Error ? e.message : "Could not complete rent.");
      setError(msg.includes("bid") ? RENT_BID_TIMEOUT_USER_MESSAGE : msg);
    } finally {
      setCompletingPending(false);
    }
  }

  async function handleRetryManifest() {
    if (!identity?.mnemonic || pendingManifestDseq == null) return;
    try {
      setRetryingManifest(true);
      setError("");
      setRentProgress(createInitialRentProgress(`Sending manifest for dseq ${pendingManifestDseq}…`));
      const result = await retryDirectAkashManifest({
        mnemonic: identity.mnemonic,
        dseq: pendingManifestDseq,
        provider: sanitizeAkashAddress(providerOwner) || undefined,
        title: `Akash ${offer?.gpu_model || offerGpu || "GPU"}`,
        hourlyAkt,
        hours: Number(hours || 1),
        gpuLabel: offer?.gpu_model || offerGpu,
        gpuModelSlug: gpuModelSlug || undefined,
        gpuVram: gpuVram || undefined,
        gpuInterface: gpuInterface || undefined,
        manifestJson: aktAddress
          ? readRentManifestJsonForDseq(aktAddress, pendingManifestDseq) ??
            readDirectRentProgress(aktAddress)?.manifestJson
          : undefined,
        onProgress: (p) => {
          setRentProgress(p);
          setInfo(p.message);
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
        },
      });
      if (aktAddress) clearDirectRentProgress(aktAddress);
      void refreshAktBalance();
      router.push(`/app/gpu/terminal/${encodeURIComponent(result.job.id)}`);
    } catch (e) {
      const msg = friendlyRpcError(e instanceof Error ? e.message : "Manifest retry failed.");
      setError(msg);
    } finally {
      setRetryingManifest(false);
    }
  }

  async function handleReleaseStuckDeployments() {
    if (!identity?.mnemonic) {
      setError("Unlock your wallet first.");
      return;
    }
    try {
      setReleasingStuck(true);
      setError("");
      const n = await closeOpenAkashDeployments({
        mnemonic: identity.mnemonic,
        onProgress: (m) => setInfo(m),
      });
      setInfo(
        n > 0
          ? `Released ${n} stuck order(s). ACT escrow returned — refresh balance, then rent again.`
          : "No stuck open orders found (or they already have a lease).",
      );
      void refreshAktBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not release stuck orders.");
      setInfo("");
    } finally {
      setReleasingStuck(false);
    }
  }

  async function handleProvisionerRent() {
    if (!identity?.mnemonic) {
      setError("Unlock your wallet with your recovery phrase.");
      return;
    }
    if (!aktAddress) {
      setError("No Akash address on this NodeShare wallet.");
      return;
    }
    const selectedOfferId = checkoutOfferId || offer?.id;
    if (!selectedOfferId) {
      setError("No Akash offer selected.");
      return;
    }
    if (offer && !offerAcceptsAktPayment(offer)) {
      setError("This offer does not accept AKT payment.");
      return;
    }

    try {
      setRenting(true);
      setError("");
      setInfo("Refreshing AKT balance…");
      await refreshAktBalance();

      const wallet = signingWalletFromIdentity(identity);

      setInfo("Preparing live AKT quote…");
      const quoteRes =
        quotePreview ||
        (await createGpuQuote({
          wallet,
          offerId: selectedOfferId,
          estimatedRuntimeMinutes: runtimeMinutes,
          paymentAsset: PAYMENT_ASSET,
          lcdOrderId: lcdReferenceId,
          providerOwner,
        }));
      setQuotePreview(quoteRes);

      const amountAktNum = quoteTotalAktNumber(quoteRes, hours, offer, offerBasePriceAkt);
      const payAmountStr = formatAktPayAmount(amountAktNum);
      if (!payAmountStr) throw new Error("Invalid quote total.");

      if (!hasSufficientAkt(amountAktNum)) {
        throw new Error(
          `Not enough AKT in your NodeShare wallet (${aktAddress}). You need ${formatAktDisplay(amountAktNum)} but have ${aktFormatted ?? formatAktDisplay(aktBalance ?? 0)}.`,
        );
      }

      setInfo("Creating GPU job draft…");
      const jobRes = await createGpuJob({
        wallet,
        quoteId: String(quoteRes.quote_id),
        title: `Akash ${offer?.gpu_model || offerGpu || "GPU"} Job`,
        category: offer?.category || "SSH GPU",
        fileManifest: [{ name: "payload.txt", kind: "input", size: 1 }],
      });
      upsertLocalGpuJob(wallet.address, jobRes.job as { id: string } & Record<string, unknown>);
      upsertGlobalGpuJob(jobRes.job as { id: string } & Record<string, unknown>);

      setInfo(`Signing ${payAmountStr} AKT from ${aktAddress.slice(0, 12)}…`);
      const treasury = getGpuAktTreasury();
      const tx = await sendAktFromMnemonic({
        mnemonic: identity.mnemonic,
        to: treasury,
        amountAkt: payAmountStr,
      });

      setInfo(
        tx.confirmedOnchain
          ? "AKT payment confirmed. Finalizing GPU job…"
          : "AKT transfer submitted. Waiting for confirmation…",
      );
      void refreshAktBalance();

      let payRes = null;
      const maxAttempts = 6;
      const paymentIdempotencyKey = `gpu-pay-${jobRes.job.id}-${String(tx.hash).toUpperCase()}`;
      const recoveryJob = {
        user_id: wallet.address.toLowerCase(),
        quote_id: quoteRes?.quote_id || "",
        provider_id: quoteRes?.quote?.provider_id || jobRes?.job?.provider_id || "",
        offer_id: selectedOfferId,
        akash_order_id: lcdReferenceId || undefined,
        akash_payer_address: aktAddress,
        amount: amountAktNum,
        payment_asset: PAYMENT_ASSET,
        payment_assets: [PAYMENT_ASSET],
        title: `Akash ${offer?.gpu_model || offerGpu || "GPU"} Job`,
        category: offer?.category || "SSH GPU",
        file_manifest: [{ name: "payload.txt", kind: "input", size: 1 }],
        ssh_access: Boolean(offer?.ssh_access),
        estimated_completion_minutes: Number(offer?.estimated_completion_minutes || 60),
      };

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          payRes = await confirmGpuPayment({
            wallet,
            jobId: jobRes.job.id,
            txHash: tx.hash,
            paymentAsset: PAYMENT_ASSET,
            chainId: getAkashChainId(),
            idempotencyKey: paymentIdempotencyKey,
            recoveryJob,
          });
          break;
        } catch (confirmErr) {
          const msg = String(confirmErr instanceof Error ? confirmErr.message : "").toLowerCase();
          try {
            const jobCheck = await fetchGpuJobById({ wallet, jobId: jobRes.job.id });
            const liveStatus = String(jobCheck?.job?.internal_status || "").toLowerCase();
            if (
              ["queued", "running", "delivered", "completed", "submitted_to_provider"].includes(
                liveStatus,
              )
            ) {
              payRes = { ok: true, job: jobCheck.job, payment: null };
              break;
            }
          } catch {
            /* continue */
          }
          const retryable =
            msg.includes("transaction not found") ||
            msg.includes("not found") ||
            msg.includes("treasury verification failed") ||
            msg.includes("504") ||
            msg.includes("timeout");
          if (retryable && attempt >= maxAttempts) {
            setLastJobId(jobRes.job.id);
            setInfo("AKT paid. Confirmation delayed — check GPU Jobs.");
            router.push("/app/gpu/jobs");
            return;
          }
          if (!retryable) throw confirmErr;
          setInfo(`Waiting for Akash confirmation (${attempt}/${maxAttempts})…`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      if (!payRes) throw new Error("Payment confirmation timed out. Check GPU Jobs in ~30 seconds.");
      setLastJobId(jobRes.job.id);
      const finalJob = { ...(jobRes?.job || {}), ...(payRes?.job || {}), id: jobRes.job.id };
      upsertLocalGpuJob(wallet.address, finalJob as { id: string } & Record<string, unknown>);
      upsertGlobalGpuJob(finalJob as { id: string } & Record<string, unknown>);

      const finalStatus = String(payRes.job?.internal_status || "").toLowerCase();
      if (finalStatus === "failed") {
        const hint = String(
          payRes.job?.error_message || payRes.job?.provider_status || "GPU provider API error",
        ).trim();
        setError(`AKT was paid but GPU placement failed (${hint}). Job id: ${jobRes.job.id}.`);
        setInfo("");
      } else {
        setInfo("Payment complete. Opening GPU terminal…");
        router.push(`/app/gpu/terminal/${encodeURIComponent(jobRes.job.id)}`);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "AKT payment failed.";
      setError(friendlyRpcError(raw));
    } finally {
      setRenting(false);
    }
  }

  function handleRentNow() {
    if (checkoutMode === "direct") return handleDirectRent();
    return handleProvisionerRent();
  }

  const previewGpu = offer?.gpu_model || offerGpu || "GPU compute";
  const previewPriceHourly =
    priceHourlyParam ||
    (hourlyAkt > 0
      ? `~${hourlyAkt.toFixed(4)} AKT/hr`
      : offerBasePriceUsd > 0
        ? `~$${offerBasePriceUsd.toFixed(2)} / hr (est.)`
        : null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href="/app/gpu/jobs">My GPU Jobs</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/app/marketplace">Back to marketplace</Link>
        </Button>
        {backendConfigured ? (
          <Button variant="ghost" asChild>
            <Link
              href={`?${new URLSearchParams({
                ...Object.fromEntries(searchParams.entries()),
                mode: checkoutMode === "direct" ? "provisioner" : "direct",
              }).toString()}`}
            >
              {checkoutMode === "direct" ? "Provisioner mode" : "Direct Akash rent"}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          {checkoutMode === "direct"
            ? "Direct Akash rent · on-chain escrow"
            : "Provisioner checkout · treasury"}
        </p>
        {offerLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-text-muted">Loading offer…</CardContent>
          </Card>
        ) : (
          <GpuOfferPreview
            size="lg"
            gpuModel={previewGpu}
            title={previewGpu}
            hasGpu
            provider={offer?.provider_name || offerProvider}
            region={offer?.region || offerRegion}
            orderRef={
              lcdReferenceId
                ? `LCD ${lcdReferenceId}`
                : checkoutOfferId
                  ? `Catalog ${checkoutOfferId}`
                  : undefined
            }
            priceHourly={previewPriceHourly}
          />
        )}
      </div>

      <NodeShareAktWalletCard
        requiredAkt={quoteTotalNum > 0 ? quoteTotalNum : undefined}
        requiredHint={
          checkoutMode === "direct" && isFirstTimeMint
            ? `First rental: burn ~${formatAktDisplay(directMintBurnAkt)} AKT to mint 10 ACT (+ gas) @ $${aktUsd.toFixed(2)}/AKT`
            : checkoutMode === "direct" && existingAct > 0 && !needsBmeMint
              ? "You already have ACT — only gas needed"
              : undefined
        }
        balanceState={aktWallet}
      />

      {checkoutMode === "direct" && existingAct >= 0.5 && !needsBmeMint && !renting ? (
        <ActCreditsBanner actBalance={existingAct} variant="checkout-ready" />
      ) : null}

      {resolveNotice && !rentBlocked ? (
        <p className="rounded-lg border border-accent/20 bg-surface-accent px-3 py-2 text-xs text-text-secondary">
          {resolveNotice}
        </p>
      ) : null}

      {slowRentWarn ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This host has no LCD spot order — NodeShare will auto-retry on open market (same model, then
          any NVIDIA GPU) within ~1 minute.
        </p>
      ) : null}

      {providerOfflineBlock || providerFullyBookedBlock || rentBlocked ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {providerOfflineBlock ? (
            <>
              This provider is <strong>offline</strong> on Akash — renting would lock ACT with no bid.
              Pick a GPU card that shows <strong>Online</strong> on the marketplace.
            </>
          ) : providerFullyBookedBlock ? (
            <>
              This host is <strong>fully booked</strong> — its GPU is already in use, so it will not bid on
              new deployments. Pick a card that shows <strong>Online</strong> with free capacity (try RTX
              3090 or A100), or refresh the marketplace later.
            </>
          ) : (
            rentBlockReason ||
            "No online host for this GPU model — pick RTX 3090, A100, or another online card."
          )}
        </p>
      ) : null}

      {providerRentWarn && providerRentWarn !== rentBlockReason ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {providerRentWarn}
        </p>
      ) : null}

      {checkoutMode === "direct" && rentWaitEstimate ? (
        <div className="rounded-lg border border-border-subtle bg-surface-base/80 px-3 py-2">
          <GpuRentWaitBadge estimate={rentWaitEstimate} showDetail />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">
            {checkoutMode === "direct" ? "On-chain pricing (AKT)" : "Pricing (AKT)"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary">Runtime (hours)</label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-20 rounded-lg border border-border-subtle px-2 py-1 text-sm"
            />
          </div>
          {checkoutMode === "direct" ? (
            <>
              {pricePerBlockParam ? (
                <p className="text-sm">
                  LCD spot: <span className="font-mono font-semibold">{pricePerBlockParam}</span>
                </p>
              ) : null}
              {lcdRuntimeTotal ? (
                <p className="text-sm">
                  Illustrative compute total:{" "}
                  <span className="font-semibold">{lcdRuntimeTotal}</span>
                </p>
              ) : null}
              {hourlySource === "usd" && priceHourlyParam ? (
                <p className="text-sm text-text-secondary">
                  Rate estimate:{" "}
                  <span className="font-mono font-semibold text-accent">
                    ~{hourlyAkt.toFixed(4)} AKT/hr
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    (from {priceHourlyParam} @ ${getAktUsdEstimate().toFixed(2)}/AKT)
                  </span>
                </p>
              ) : hourlySource === "reference" ? (
                <p className="text-sm text-text-secondary">
                  Akash reference rate:{" "}
                  <span className="font-mono font-semibold text-accent">
                    ~${offerBasePriceUsd > 0 ? offerBasePriceUsd.toFixed(2) : (hourlyAkt * getAktUsdEstimate()).toFixed(2)}/hr
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    (~{hourlyAkt.toFixed(4)} AKT/hr @ ${getAktUsdEstimate().toFixed(2)}/AKT). Provider bid may differ.
                  </span>
                </p>
              ) : hourlySource === "default" ? (
                <p className="text-xs text-text-muted">
                  Using fallback rate (~{hourlyAkt.toFixed(2)} AKT/hr). Chain minimum escrow is 0.5 ACT.
                </p>
              ) : null}
              <p className="text-sm">
                Escrow for this rental:{" "}
                <span className="font-semibold text-accent">{formatActDisplay(directDepositAct)}</span>
                <span className="text-text-muted">
                  {" "}
                  (~{formatAktDisplay(directDepositAktEq)} · held on-chain, not sent to a treasury)
                </span>
              </p>
              {existingAct > 0 ? (
                <p className="text-xs text-text-muted">
                  Wallet ACT balance: {actFormatted ?? formatActDisplay(existingAct)}
                  {needsBmeMint
                    ? ` · minting ${formatActDisplay(directMintAct)} more before deploy`
                    : " · enough ACT — no mint needed"}
                </p>
              ) : null}
              {isFirstTimeMint ? (
                <p className="text-xs text-amber-900">
                  Akash requires a one-time mint of at least {formatActDisplay(BME_MIN_MINT_UACT / UACT_PER_ACT)} on
                  your first rental — burn ~{formatAktDisplay(directMintBurnAkt)} AKT at ${aktUsd.toFixed(3)}/AKT
                  ({aktUsdSource}). Only {formatActDisplay(directDepositAct)} goes to escrow; ~
                  {formatActDisplay(leftoverAct)} stays in your wallet for cheaper follow-up rentals.
                </p>
              ) : needsBmeMint ? (
                <p className="text-xs text-text-muted">
                  Minting {formatActDisplay(directMintAct)} before deploy. Unused ACT stays in your wallet.
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  No ACT mint needed — paying gas only (~{formatAktDisplay(directBurnAkt)}).
                </p>
              )}
              <p className="text-xs text-text-muted">
                Total from wallet now: ~{formatAktDisplay(directBurnAkt)} (BME burn + on-chain gas).
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="h-10 px-4"
                  disabled={quoteLoading || offerLoading || !walletReady}
                  onClick={() => void loadLiveQuote()}
                >
                  {quoteLoading ? "Loading quote…" : "Load live AKT quote"}
                </Button>
              </div>
              <p className="text-sm">
                Total due: <span className="font-semibold text-accent">{totalLabel}</span>
              </p>
              {breakdownMismatch ? (
                <p className="text-xs text-amber-800">Reload quote if breakdown looks stale.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {hasLiveQuote && quoteTotalNum > 0 && aktAddress ? (
        <AktCheckoutPayment
          aktAddress={aktAddress}
          aktFormatted={aktFormatted}
          aktBalance={aktBalance}
          payAmount={quoteTotalNum}
          loading={aktWallet.loading}
          waitEstimate={rentWaitEstimate}
        />
      ) : null}

      {checkoutMode === "direct" ? (
        <DirectAkashRentTracker
          progress={rentProgress}
          showPreview={!rentProgress && !renting}
          actBalance={actBalance}
          waitEstimate={rentWaitEstimate}
        />
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <Button
            type="button"
            className="h-11 w-full px-6 sm:w-auto"
            disabled={renting || quoteLoading || offerLoading || !canPay}
            onClick={() => void handleRentNow()}
          >
            {renting
              ? checkoutMode === "direct"
                ? rentProgress?.steps.provider_bids?.status === "active" ||
                  rentProgress?.steps.create_deployment?.status === "complete"
                  ? "Waiting for provider bid…"
                  : "Starting Akash rent…"
                : "Paying from wallet…"
              : checkoutMode === "direct"
                ? `Rent GPU · ${formatActDisplay(directDepositAct)} escrow`
                : `Pay ${totalLabel} from NodeShare wallet`}
          </Button>
          {!walletReady ? (
            <p className="text-sm text-amber-900">
              Unlock your NodeShare wallet to rent with{" "}
              <span className="font-mono text-xs">{aktAddress?.slice(0, 12)}…</span>
            </p>
          ) : null}
          {genericGpuOffer && checkoutMode === "direct" ? (
            <p className="text-xs text-amber-900">
              This LCD bid does not name a specific GPU. For a named model (RTX 4090, A100, etc.),{" "}
              <Link href="/app/marketplace" className="font-semibold underline">
                pick from the GPU catalog
              </Link>
              . You can still rent any NVIDIA GPU from this provider below.
            </p>
          ) : null}
          {!canPay && walletReady && quoteTotalNum > 0 ? (
            <p className="text-xs text-amber-900">
              {providerOfflineBlock || providerFullyBookedBlock || rentBlocked ? (
                <>
                  {providerFullyBookedBlock
                    ? "Host fully booked — pick another GPU with free capacity on the marketplace."
                    : rentBlockReason ||
                      "This GPU cannot be rented right now — pick an Online card on the marketplace."}
                </>
              ) : !hasSufficientAkt(quoteTotalNum) ? (
                isFirstTimeMint && aktTopUp > 0 ? (
                  <>
                    First Akash GPU rental requires minting at least 10 ACT on-chain (~
                    {formatAktDisplay(directMintBurnAkt)} AKT burn + gas). You have{" "}
                    {aktFormatted ?? formatAktDisplay(aktBalance ?? 0)} — send at least{" "}
                    <span className="font-semibold">{formatAktDisplay(aktTopUp)}</span> more AKT to your
                    address, refresh, then try again. Follow-up rentals only need ~0.5 ACT escrow + gas.
                  </>
                ) : (
                  <>
                    Add AKT to your wallet ({formatAktDisplay(quoteTotalNum)} required
                    {aktTopUp > 0 ? `, short by ${formatAktDisplay(aktTopUp)}` : ""}), then refresh.
                  </>
                )
              ) : (
                <>Unlock your wallet or finish loading the offer to continue.</>
              )}
            </p>
          ) : null}
          {error ? (
            <p className="whitespace-pre-wrap break-words text-xs text-rose-700">{error}</p>
          ) : null}
          {pendingBidDseq && walletReady ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <p className="text-xs text-amber-950">
                Deployment <span className="font-mono">dseq {pendingBidDseq}</span> has open
                provider bids on-chain. Complete the lease without paying escrow again (~0.02 AKT
                gas only).
              </p>
              <Button
                type="button"
                className="mt-2 h-9 w-full text-xs sm:w-auto"
                disabled={renting || completingPending || retryingManifest}
                onClick={() => void handleCompletePendingRent()}
              >
                {completingPending ? "Accepting bid…" : "Complete pending rent"}
              </Button>
            </div>
          ) : null}
          {pendingManifestDseq && walletReady ? (
            <div
              className={`rounded-lg border p-3 ${
                pendingManifestNonRetryable
                  ? "border-amber-200 bg-amber-50/80"
                  : "border-emerald-200 bg-emerald-50/80"
              }`}
            >
              <p
                className={`text-xs ${
                  pendingManifestNonRetryable ? "text-amber-950" : "text-emerald-950"
                }`}
              >
                {pendingManifestBidMismatch ? (
                  <>
                    Lease for <span className="font-mono">dseq {pendingManifestDseq}</span> is
                    active, but the provider&apos;s bid does not match your deployment (wrong GPU
                    class). <strong>Do not retry manifest</strong> — close the deployment to recover
                    ACT, then rent again from the marketplace.
                  </>
                ) : pendingManifestNonRetryable ? (
                  <>
                    Lease for <span className="font-mono">dseq {pendingManifestDseq}</span> is
                    active and the manifest hash is correct, but this provider still rejected
                    delivery. <strong>Do not retry</strong> — close the deployment to recover ACT and
                    rent on a different host.
                  </>
                ) : (
                  <>
                    Lease for <span className="font-mono">dseq {pendingManifestDseq}</span> is
                    already on-chain. Only the manifest upload failed (browser could not reach the
                    provider).
                  </>
                )}
              </p>
              {pendingManifestNonRetryable ? (
                <Button variant="secondary" className="mt-2 h-9 w-full text-xs sm:w-auto" asChild>
                  <Link href="/app/gpu/jobs">Close &amp; recover ACT on GPU Jobs</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  className="mt-2 h-9 w-full text-xs sm:w-auto"
                  disabled={renting || completingPending || retryingManifest}
                  onClick={() => void handleRetryManifest()}
                >
                  {retryingManifest ? "Sending manifest…" : "Retry manifest"}
                </Button>
              )}
            </div>
          ) : null}
          {info && !rentProgress ? <p className="text-xs text-emerald-700">{info}</p> : null}
          {lastJobId ? (
            <Button variant="secondary" asChild>
              <Link href="/app/gpu/jobs">Track job {lastJobId}</Link>
            </Button>
          ) : null}
          {checkoutMode === "direct" ? (
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <p className="text-[11px] text-text-secondary">
                Stuck on provider bids? Old orders lock ACT until you close them.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="h-9 text-xs" asChild>
                  <Link href="/app/gpu/stuck-orders">Stuck orders page</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 text-xs"
                  disabled={renting || releasingStuck || !walletReady}
                  onClick={() => void handleReleaseStuckDeployments()}
                >
                  {releasingStuck ? "Releasing…" : "Quick release all"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
