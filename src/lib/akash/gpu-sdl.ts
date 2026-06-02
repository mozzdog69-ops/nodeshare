import { AKASH_COMPUTE_DENOM, BME_MIN_MINT_UACT, UACT_PER_ACT, UAKT_PER_AKT } from "@/lib/akash/chain-config";
import { aktBurnForActMint, getAktUsdEstimate } from "@/lib/akash/akt-price";
import {
  isPremiumGpuModelSlug,
  lookupReferenceUsdHourly,
  resolveAkashGpuModelSlug,
} from "@/lib/akash/gpu-reference-pricing";
import {
  minimumUactPerBlockForModel,
  parseUactPerBlockFromPrice,
  resolveGpuResourceProfile,
} from "@/lib/akash/gpu-rent-profile";
import { AKASH_BLOCKS_PER_HOUR, AKASH_AVG_BLOCK_SECONDS } from "@/lib/akash/pricing";
import {
  manifestSortedJsonWithSort,
  manifestVersionFromJson,
} from "@/lib/akash/manifest-version-go";
import { SDL } from "@akashnetwork/chain-sdk/sdl";

const USDC_IBC_MAINNET =
  "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";

/**
 * chain-sdk@alpha.0 SDL validator only allows uakt/USDC — patch to accept uact (post-BME).
 * Upgrading the SDK breaks our import paths; this is the minimal fix until we migrate.
 */
function parseAkashSdlYaml(yaml: string, version: "beta2" | "beta3" = "beta3") {
  const proto = SDL.prototype as unknown as {
    validateDenom: () => void;
    groups: () => { resources: { price: { denom: string } }[] }[];
  };
  const original = proto.validateDenom;
  proto.validateDenom = function validateDenomWithAct() {
    const denoms = this.groups()
      .flatMap((g) => g.resources)
      .map((resource) => resource.price.denom);
    const invalid = denoms.find(
      (denom) => denom !== "uakt" && denom !== "uact" && denom !== USDC_IBC_MAINNET,
    );
    if (invalid) {
      throw new Error(
        `Invalid denom: "${invalid}". Only uakt, uact and ${USDC_IBC_MAINNET} are supported.`,
      );
    }
  };
  try {
    return SDL.fromString(yaml, version);
  } finally {
    proto.validateDenom = original;
  }
}

export type GpuSdlInput = {
  /** Preferred provider — used by the app when filtering bids, not in SDL. */
  providerOwner?: string;
  /** Preferred providers — bid filtering only; never written to SDL signedBy. */
  providerOwners?: string[];
  /** If true (default), any Akash provider matching the GPU profile can bid on-chain. */
  openToAnyProvider?: boolean;
  /** Live AKT/USD for competitive bid pricing. */
  aktUsd?: number;
  gpuLabel?: string;
  /** Provider registry model slug (preferred for SDL). */
  gpuModelSlug?: string;
  gpuVram?: string;
  gpuInterface?: string;
  /** Hourly AKT rate (whole AKT, not uakt). */
  hourlyAkt: number;
  /** Runtime hours — used for deposit sizing. */
  hours: number;
  cpuUnits?: number;
  memoryGi?: number;
  storageGi?: number;
  /** Match any NVIDIA GPU (faster bids when a specific model is scarce). */
  anyNvidiaGpu?: boolean;
  /** Override chain bid amount (uact per block). */
  uactPerBlockOverride?: string;
  /** Raw LCD spot price from marketplace (uact/block). */
  lcdPriceAmount?: string | null;
  lcdPriceDenom?: string | null;
  /** Multiplier for bid rate on retry phases (default 1). */
  bidEscalation?: number;
};

function sanitizeProvider(addr: string): string {
  const a = addr.trim();
  if (!/^akash1[a-z0-9]{38}$/.test(a)) {
    throw new Error("A valid akash1… provider address is required.");
  }
  return a;
}

function normalizeGpuInterface(iface: string | undefined): string | null {
  const raw = String(iface || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("pcie")) return "pcie";
  if (raw.startsWith("sxm")) return "sxm";
  return null;
}

function normalizeGpuVram(vram: string | undefined): string | null {
  const raw = String(vram || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d+)\s*(Gi|GB|Mi|MB)?$/i);
  if (!m) return null;
  const unit = (m[2] || "Gi").toLowerCase().startsWith("g") ? "Gi" : "Mi";
  return `${m[1]}${unit}`;
}

function buildGpuAttributesYaml(input: GpuSdlInput): string {
  if (input.anyNvidiaGpu) {
    return `            vendor:
              nvidia:`;
  }
  const model = resolveAkashGpuModelSlug({
    gpuModelSlug: input.gpuModelSlug,
    gpuLabel: input.gpuLabel,
  });
  const vram = normalizeGpuVram(input.gpuVram);
  const iface = normalizeGpuInterface(input.gpuInterface);

  if (!model) {
    return `            vendor:
              nvidia:`;
  }

  const extras: string[] = [];
  if (vram) extras.push(`          ram: ${vram}`);
  if (iface) extras.push(`          interface: ${iface}`);
  const extraBlock = extras.length ? `\n${extras.join("\n")}` : "";

  return `            vendor:
              nvidia:
                - model: ${model}${extraBlock}`;
}

/** Bid rate high enough that provider automation picks up the order quickly. */
export function competitiveBidUsdPerHour(input: {
  hourlyAkt: number;
  aktUsd?: number;
  gpuLabel?: string;
  gpuModelSlug?: string;
  /** Open market — slightly lower floor; locked hosts use aggressive rates. */
  openMarket?: boolean;
}): number {
  const aktUsd = Number(input.aktUsd) > 0 ? Number(input.aktUsd) : getAktUsdEstimate();
  const userUsd = Math.max(0.02, input.hourlyAkt * aktUsd);
  const slug =
    resolveAkashGpuModelSlug({
      gpuModelSlug: input.gpuModelSlug,
      gpuLabel: input.gpuLabel,
    }) ?? "";
  const ref =
    lookupReferenceUsdHourly(input.gpuLabel || "") ??
    lookupReferenceUsdHourly(input.gpuModelSlug || "") ??
    userUsd;
  const premium = isPremiumGpuModelSlug(slug);
  if (input.openMarket) {
    return Math.max(userUsd * 1.75, ref * (premium ? 1.75 : 1.35));
  }
  return Math.max(userUsd * (premium ? 2.75 : 2.25), ref * (premium ? 2.25 : 1.85));
}

export function buildGpuSdlYaml(input: GpuSdlInput): string {
  const gpuAttributes = buildGpuAttributesYaml(input);
  const profile = resolveGpuResourceProfile(input);
  const cpu = Math.max(1, input.cpuUnits ?? profile.cpuUnits);
  const memGi = Math.max(1, input.memoryGi ?? profile.memoryGi);
  const storageGi = Math.max(1, input.storageGi ?? profile.storageGi);
  const modelSlug =
    resolveAkashGpuModelSlug({
      gpuModelSlug: input.gpuModelSlug,
      gpuLabel: input.gpuLabel,
    }) ?? "";
  const openMarket = input.openToAnyProvider !== false;
  const bidUsdHr = competitiveBidUsdPerHour({
    hourlyAkt: input.hourlyAkt,
    aktUsd: input.aktUsd,
    gpuLabel: input.gpuLabel,
    gpuModelSlug: input.gpuModelSlug,
    openMarket,
  });
  const lcdUact = parseUactPerBlockFromPrice(input.lcdPriceAmount, input.lcdPriceDenom);
  const computedUact = Number(hourlyUsdToUactPerBlock(bidUsdHr));
  const floor = minimumUactPerBlockForModel(modelSlug || "gpu", openMarket);
  const override = Number(input.uactPerBlockOverride);
  const lcdNum = lcdUact ? Number(lcdUact) : 0;
  const catalogBoost = lcdNum > 0 || input.providerOwner ? 1.55 : 1;
  const bidBoost =
    (openMarket ? 1.45 : 1.55) * Math.max(1, input.bidEscalation ?? 1) * catalogBoost;
  const anyGpuFloor = input.anyNvidiaGpu ? Math.max(floor, openMarket ? 10_000 : 14_000) : floor;
  const refUsd =
    lookupReferenceUsdHourly(modelSlug) ??
    lookupReferenceUsdHourly(input.gpuLabel || "") ??
    0;
  const refUactFloor = refUsd > 0 ? Number(hourlyUsdToUactPerBlock(refUsd * 2.2)) : 0;
  const uactPerBlock = String(
    Number.isFinite(override) && override > 0
      ? Math.max(Math.ceil(override * bidBoost), anyGpuFloor, refUactFloor)
      : lcdNum > 0
        ? Math.max(Math.ceil(lcdNum * bidBoost * 1.35), anyGpuFloor, refUactFloor)
        : Math.max(Math.ceil(computedUact * bidBoost), anyGpuFloor, refUactFloor),
  );

  return `version: "2.0"

services:
  gpu:
    image: ubuntu:22.04
    command: ["sleep", "infinity"]
    expose:
      - port: 22
        as: 22
        to:
          - global: true

profiles:
  compute:
    gpu:
      resources:
        cpu:
          units: ${cpu}
        memory:
          size: ${memGi}Gi
        storage:
          - size: ${storageGi}Gi
        gpu:
          units: 1
          attributes:
${gpuAttributes}
  placement:
    dcloud:
      pricing:
        gpu:
          denom: ${AKASH_COMPUTE_DENOM}
          amount: ${uactPerBlock}

deployment:
  gpu:
    dcloud:
      profile: gpu
      count: 1
`;
}

/** USD/hr → uact per block (ACT ≈ $1). */
export function hourlyUsdToUactPerBlock(usdPerHour: number): string {
  if (!Number.isFinite(usdPerHour) || usdPerHour <= 0) return "1000";
  const perBlockUsd = usdPerHour / AKASH_BLOCKS_PER_HOUR;
  const uact = Math.max(1, Math.ceil(perBlockUsd * UACT_PER_ACT));
  return String(uact);
}

/** AKT/hr estimate → uact/block via AKT/USD oracle estimate. */
export function hourlyAktToUactPerBlock(hourlyAkt: number): string {
  const usd = hourlyAkt * getAktUsdEstimate();
  return hourlyUsdToUactPerBlock(usd);
}

/** @deprecated use hourlyAktToUactPerBlock — kept for LCD AKT bids */
export function hourlyAktToUaktPerBlock(hourlyAkt: number): string {
  if (!Number.isFinite(hourlyAkt) || hourlyAkt <= 0) return "1000";
  const perBlockAkt = hourlyAkt / AKASH_BLOCKS_PER_HOUR;
  const uakt = Math.max(1, Math.ceil(perBlockAkt * UAKT_PER_AKT));
  return String(uakt);
}

/** On-chain deployment escrow in uact (chain min 0.5 ACT + runtime). */
export function estimateDepositUact(hours: number, hourlyAkt: number): string {
  const h = Math.max(1, Number(hours) || 1);
  const usdPerHour = Math.max(0.001, Number(hourlyAkt) || 0.001) * getAktUsdEstimate();
  const runtimeUact = Math.ceil(usdPerHour * h * UACT_PER_ACT * 1.15);
  const depositUact = Math.max(500_000, runtimeUact);
  return String(depositUact);
}

/** uact to mint — covers deposit shortfall; BME enforces ≥10 ACT per mint tx when minting. */
export function estimateMintUactForWallet(depositUact: string | number, existingUact = 0): string {
  const deposit = Number(depositUact) || 0;
  const existing = Math.max(0, Number(existingUact) || 0);
  if (existing >= deposit) return "0";
  const shortfall = deposit - existing;
  return String(Math.max(shortfall, BME_MIN_MINT_UACT));
}

/** @deprecated assumes zero ACT balance — prefer estimateMintUactForWallet */
export function estimateMintUactForDeposit(depositUact: string | number): string {
  return estimateMintUactForWallet(depositUact, 0);
}

/** Reserve uakt for cert + mint + deploy + lease gas (≈4 txs). */
export const DIRECT_RENT_GAS_RESERVE_UAKT = 300_000;

/** uakt to burn in MsgBurnMint / MsgMintACT (excludes tx gas). */
export function estimateBurnUaktForMintAmount(
  mintUact: string | number,
  aktUsd = getAktUsdEstimate(),
): string {
  const mint = Number(mintUact) || 0;
  if (mint <= 0) return "0";
  const mintAct = mint / UACT_PER_ACT;
  const burnAkt = aktBurnForActMint(mintAct, aktUsd);
  const uakt = Math.ceil(Math.max(0.01, burnAkt) * UAKT_PER_AKT);
  return String(uakt);
}

/** Wallet uakt needed for direct rent (BME burn + gas for on-chain txs). */
export function estimateDirectRentWalletUakt(
  depositUact: string | number,
  existingUact = 0,
  aktUsd = getAktUsdEstimate(),
): string {
  const mintUact = estimateMintUactForWallet(depositUact, existingUact);
  const burn = Number(estimateBurnUaktForMintAmount(mintUact, aktUsd)) || 0;
  const gas = mintUact === "0" ? 150_000 : DIRECT_RENT_GAS_RESERVE_UAKT;
  return String(burn + gas);
}

/** @deprecated use estimateDirectRentWalletUakt for wallet checks */
export function estimateBurnUaktForDeposit(
  depositUact: string | number,
  existingUact = 0,
  aktUsd = getAktUsdEstimate(),
): string {
  return estimateDirectRentWalletUakt(depositUact, existingUact, aktUsd);
}

export async function parseGpuSdl(input: GpuSdlInput) {
  const yaml = buildGpuSdlYaml(input);
  const sdl = parseAkashSdlYaml(yaml, "beta3");
  const groups = sdl.groups();
  const sdlAny = sdl as {
    manifest?: (asString?: boolean) => unknown;
    manifestSortedJSON?: () => string;
    SortJSON?: (jsonStr: string) => string;
  };
  if (
    typeof sdlAny.manifest !== "function" ||
    typeof sdlAny.manifestSortedJSON !== "function" ||
    typeof sdlAny.SortJSON !== "function"
  ) {
    throw new Error("Could not build Akash manifest from SDL.");
  }
  // manifest(true) → string .val fields; SortJSON matches chain-sdk + provider cosmos sort.
  sdlAny.manifest(true);
  const manifest = JSON.parse(sdl.manifestSortedJSON()) as unknown;
  const manifestJson = manifestSortedJsonWithSort(manifest, (jsonStr) => sdl.SortJSON(jsonStr));
  const hash = await manifestVersionFromJson(manifestJson);
  return { yaml, sdl, groups, hash, manifest, manifestJson };
}

export function blocksForHours(hours: number): number {
  return Math.ceil((Math.max(1, hours) * 3600) / AKASH_AVG_BLOCK_SECONDS);
}

/** @deprecated renamed — use estimateDepositUact */
export function estimateDepositUakt(hours: number, hourlyAkt: number): string {
  return estimateDepositUact(hours, hourlyAkt);
}
