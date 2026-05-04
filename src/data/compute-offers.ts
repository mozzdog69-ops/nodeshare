export type ComputeOffer = {
  id: string;
  title: string;
  gpu: string;
  price: string;
  badge: string;
  slots: number;
  endsInSec: number;
};

export const COMPUTE_OFFERS: readonly ComputeOffer[] = [
  {
    id: "a10-spot",
    title: "A10 spot — US-East",
    gpu: "NVIDIA A10 · 24 GB",
    price: "$0.38/hr",
    badge: "Akash",
    slots: 14,
    endsInSec: 3600 * 4 + 120,
  },
  {
    id: "l40s-batch",
    title: "L40S batch window",
    gpu: "NVIDIA L40S · 48 GB",
    price: "$0.51/hr",
    badge: "Mesh",
    slots: 6,
    endsInSec: 3600 * 9 + 45,
  },
  {
    id: "a100-train",
    title: "A100 training block",
    gpu: "A100 40G · NVLink-ready",
    price: "$1.95/hr",
    badge: "Limited",
    slots: 3,
    endsInSec: 3600 * 24 + 600,
  },
] as const;

export function formatOfferCountdown(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}
