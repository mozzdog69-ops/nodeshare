export type GpuOffer = {
  id: string;
  gpu_model?: string;
  gpu?: string;
  title?: string;
  region?: string;
  provider_name?: string;
  provider?: string;
  base_price?: number;
  category?: string;
  ssh_access?: boolean;
  estimated_completion_minutes?: number;
  estimated_queue_minutes?: number;
  description?: string;
  payment_assets?: string[];
  vram_gb?: number;
  currency_or_token?: string;
  pricing_type?: string;
  success_rate?: number;
  rating?: number;
  availability_status?: string;
  provider_code?: string;
};

export type GpuQuotePreview = {
  quote_id?: string;
  total?: number | string;
  quote?: {
    total_amount?: number | string;
    totalAmount?: number | string;
    provider_id?: string;
    payment_assets?: string[];
  };
  line_items?: {
    provider_base_cost?: number;
    platform_fee?: number;
    platform_fee_percent?: number;
    network_fee_estimate?: number;
    tax_amount?: number;
  };
};

import type { DirectRentProgressSnapshot } from "@/lib/akash/direct-rent-steps";

export type GpuJob = {
  id: string;
  kind?: "akash-lease" | "provisioner";
  /** On-chain lease state from LCD (`active`, `closed`, …). */
  lease_state?: string;
  internal_status?: string;
  provider_status?: string;
  /** In-flight direct rent step tracker (local / persisted). */
  rent_progress?: DirectRentProgressSnapshot;
  error_message?: string;
  created_at?: string;
  title?: string;
  provider_id?: string;
  dseq?: number;
  gseq?: number;
  oseq?: number;
  owner?: string;
  provider_owner?: string;
  deposit_akt?: number;
  gpu_model?: string;
  deployment_tx_hash?: string;
  lease_tx_hash?: string;
  /** Saved at deploy time so bid resume can rebuild the manifest. */
  rent_sdl?: {
    hourlyAkt: number;
    hours: number;
    gpuLabel?: string;
    gpuModelSlug?: string;
    gpuVram?: string;
    gpuInterface?: string;
    openToAnyProvider?: boolean;
    anyNvidiaGpu?: boolean;
    providerOwner?: string;
    manifestJson?: string;
  };
};

export type AkashLeaseJob = GpuJob & {
  kind: "akash-lease";
  dseq: number;
  provider_owner: string;
};

export type GpuSigningWallet = {
  address: string;
  privateKey: string;
};
