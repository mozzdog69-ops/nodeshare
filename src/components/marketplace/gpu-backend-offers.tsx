"use client";



import { GpuOfferPreview } from "@/components/gpu/gpu-offer-preview";

import { useAkashGpuCatalog } from "@/hooks/use-akash-gpu-catalog";

import { useGpuBackendStatus } from "@/hooks/use-gpu-backend-status";

import { buildCheckoutSearchParams } from "@/lib/gpu/quote-utils";

import type { GpuOffer } from "@/lib/gpu/types";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import Link from "next/link";



function CatalogSkeleton() {

  return (

    <div className="h-64 animate-pulse rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated" />

  );

}



function catalogPriceLine(offer: GpuOffer): string | null {

  const base = Number(offer.base_price);

  const token = String(offer.currency_or_token || "AKT").toUpperCase();

  if (Number.isFinite(base) && base > 0) {

    return `~${base.toFixed(4)} ${token}/hr`;

  }

  return null;

}



function CatalogOfferCard({ offer }: { offer: GpuOffer }) {

  const gpuName = offer.gpu_model || offer.gpu || offer.title || "GPU";

  const priceHourly = catalogPriceLine(offer);

  const vram =

    Number(offer.vram_gb) > 0 ? `${offer.vram_gb} GB VRAM` : null;

  const queue =

    Number(offer.estimated_queue_minutes) > 0

      ? `~${offer.estimated_queue_minutes} min queue`

      : null;



  return (

    <Card className="overflow-hidden border-2 border-accent/25 shadow-card">

      <CardContent className="space-y-0 p-0">

        <GpuOfferPreview

          size="lg"

          gpuModel={gpuName}

          title={offer.title}

          hasGpu

          provider={offer.provider_name || offer.provider || "Akash"}

          region={offer.region || "Global"}

          priceHourly={priceHourly}

          resourceChips={[vram, queue, offer.category].filter(Boolean) as string[]}

        />

        <div className="space-y-3 border-t border-border-subtle bg-white px-4 py-4">

          {offer.description ? (

            <p className="text-sm text-text-secondary">{offer.description}</p>

          ) : null}

          <dl className="grid grid-cols-2 gap-2 text-xs">

            {offer.success_rate != null ? (

              <>

                <dt className="text-text-muted">Success rate</dt>

                <dd className="font-mono font-semibold text-text-primary">{offer.success_rate}%</dd>

              </>

            ) : null}

            {Array.isArray(offer.payment_assets) && offer.payment_assets.length > 0 ? (

              <>

                <dt className="text-text-muted">Payment</dt>

                <dd className="font-semibold text-text-primary">

                  {offer.payment_assets.join(", ")}

                </dd>

              </>

            ) : null}

            <dt className="text-text-muted">Offer id</dt>

            <dd className="truncate font-mono text-[10px] text-text-secondary">{offer.id}</dd>

          </dl>

          <Button className="w-full" asChild>

            <Link

              href={`/app/marketplace/checkout?${buildCheckoutSearchParams({

                offerId: offer.id,

                title: gpuName,

                provider: offer.provider_name || offer.provider,

                basePriceAkt: offer.base_price,

                gpuLabel: gpuName,

              })}`}

            >

              Rent with AKT (NodeShare wallet)

            </Link>

          </Button>

        </div>

      </CardContent>

    </Card>

  );

}



export function GpuBackendOffers() {

  const { configured, loading: statusLoading } = useGpuBackendStatus();

  const { offers, loading, error } = useAkashGpuCatalog({ enabled: configured });



  if (statusLoading || !configured) {

    return null;

  }

  if (!loading && !error && offers.length === 0) {

    return null;

  }

  return (

    <section className="space-y-4">

      <div>

        <p className="text-xs font-bold uppercase tracking-wider text-accent">Rent with NodeShare AKT</p>

        <h2 className="text-lg font-bold text-text-primary">One-click GPU catalog</h2>

        <p className="mt-1 text-sm text-text-secondary">

          Requires <code className="rounded bg-surface-subtle px-1 font-mono text-xs">GPU_BACKEND_URL</code>.
          Checkout charges your <span className="font-semibold">NodeShare Akash wallet balance</span> in
          AKT — not Ethereum USDC.

        </p>

      </div>



      {loading ? (

        <div className="grid gap-4 sm:grid-cols-2">

          <CatalogSkeleton />

          <CatalogSkeleton />

        </div>

      ) : error ? (

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">

          <p className="font-semibold">GPU catalog unreachable</p>

          <p className="mt-1 text-amber-900/90">{error}</p>

          <p className="mt-2 text-xs text-amber-800">

            Check <code className="rounded bg-white/80 px-1 font-mono">GPU_BACKEND_URL</code> and{" "}

            <code className="rounded bg-white/80 px-1 font-mono">GPU_API_KEY</code>. LCD bids below still

            work for manual deploy on Akash Console.

          </p>

        </div>

      ) : offers.length === 0 ? (

        <div className="rounded-xl border border-border-subtle bg-surface-elevated px-4 py-4 text-sm text-text-secondary">

          <p className="font-medium text-text-primary">No catalog offers from the provisioning API</p>

          <p className="mt-1 text-xs">

            Your backend returned zero Akash GPU offers. Configure Akash provider keys on the server, or

            rent from the LCD section below via Akash Console.

          </p>

        </div>

      ) : (

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          {offers.map((offer) => (

            <CatalogOfferCard key={offer.id} offer={offer} />

          ))}

        </div>

      )}

    </section>

  );

}

