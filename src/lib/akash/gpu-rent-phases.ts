import type { GpuSdlInput } from "@/lib/akash/gpu-sdl";
import {
  RENT_BID_MAX_WAIT_MS,
  RENT_LOCKED_CATALOG_WAIT_MS,
  RENT_PHASE_WAIT_WEIGHTS,
} from "@/lib/akash/gpu-rent-profile";
import { LOW_BID_RELIABILITY_PROVIDERS } from "@/lib/akash/rent-wait-estimate";

export type RentPhaseKind = "locked" | "model" | "any_nvidia";

export type RentDeployPhase = {
  kind: RentPhaseKind;
  label: string;
  sdl: GpuSdlInput;
  allowedProviders?: string[];
  /** Multiply on-chain uact/block for this attempt (escalation). */
  bidEscalation?: number;
};

export type RentPhasePlanInput = GpuSdlInput & {
  providerOwners?: string[];
  openToAnyProvider?: boolean;
};

export type BuildRentPhasesOptions = {
  /** Skip locking to catalog host when that host is unlikely to auto-bid. */
  skipLockedCatalogPhase?: boolean;
  /** Marketplace picked a specific GPU — do not widen to any NVIDIA. */
  skipAnyNvidiaPhase?: boolean;
};

/** Escalating deploy strategy used for every direct Akash GPU rent. */
export function buildRentPhases(
  input: RentPhasePlanInput,
  providerOwners: string[],
  openMarket: boolean,
  options?: BuildRentPhasesOptions,
): RentDeployPhase[] {
  const phases: RentDeployPhase[] = [];
  const stripVram = { gpuVram: undefined, gpuInterface: undefined };

  if (!openMarket && providerOwners.length > 0 && !options?.skipLockedCatalogPhase) {
    const slowHost = providerOwners.some((p) =>
      LOW_BID_RELIABILITY_PROVIDERS.has(p.trim().toLowerCase()),
    );
    phases.push({
      kind: "locked",
      label: "your marketplace host",
      bidEscalation: slowHost ? 1.55 : 1.35,
      sdl: {
        ...input,
        ...stripVram,
        openToAnyProvider: true,
        providerOwners: undefined,
        providerOwner: undefined,
        anyNvidiaGpu: false,
      },
      allowedProviders: providerOwners,
    });
  }
  phases.push({
    kind: "model",
    label: "same GPU model",
    bidEscalation: 1.25,
    sdl: {
      ...input,
      ...stripVram,
      openToAnyProvider: true,
      providerOwners: undefined,
      providerOwner: undefined,
      anyNvidiaGpu: false,
    },
  });
  if (!options?.skipAnyNvidiaPhase) {
    phases.push({
      kind: "any_nvidia",
      label: "any NVIDIA GPU",
      bidEscalation: 1.4,
      sdl: {
        ...input,
        ...stripVram,
        openToAnyProvider: true,
        providerOwners: undefined,
        providerOwner: undefined,
        anyNvidiaGpu: true,
        gpuModelSlug: undefined,
        gpuLabel: undefined,
      },
    });
  }
  return phases;
}

export function phaseWaitMsForPhase(
  phaseIndex: number,
  phaseCount: number,
  phase?: Pick<RentDeployPhase, "kind">,
): number {
  if (phase?.kind === "locked") {
    return Math.min(RENT_LOCKED_CATALOG_WAIT_MS, 90_000);
  }
  const weights =
    phaseCount <= 1
      ? [0.65]
      : phaseCount === 2
        ? [0.35, 0.65]
        : [...RENT_PHASE_WAIT_WEIGHTS];
  const w = weights[Math.min(phaseIndex, weights.length - 1)] ?? 1 / phaseCount;
  return Math.max(45_000, Math.floor(RENT_BID_MAX_WAIT_MS * w));
}

/** @deprecated use phaseWaitMsForPhase */
export function phaseWaitMsForCount(phaseCount: number): number {
  return phaseWaitMsForPhase(0, phaseCount);
}
