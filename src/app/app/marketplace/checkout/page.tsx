import { GpuCheckoutPanel } from "@/components/gpu/gpu-checkout-panel";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "GPU Checkout",
};

export default function MarketplaceCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
          Loading checkout…
        </div>
      }
    >
      <GpuCheckoutPanel />
    </Suspense>
  );
}
