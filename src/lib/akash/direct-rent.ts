import { Source } from "@akashnetwork/chain-sdk/chain/types/akash.v1";
import Long from "long";
import type { AkashChainSdk } from "@/lib/akash/akash-sdk-client";
import { createAkashSdkFromMnemonic } from "@/lib/akash/akash-sdk-client";
import { generateAkashCertificatePem } from "@/lib/akash/akash-certificate";
import {
  readManifestCertificatePem,
  saveManifestCertificatePem,
} from "@/lib/akash/manifest-certificate-storage";
import { formatManifestUploadError, sendManifestToProvider } from "@/lib/akash/send-manifest";
import { fetchLiveAktUsd, getAktUsdEstimate } from "@/lib/akash/akt-price";
import { AKASH_COMPUTE_DENOM, UACT_PER_ACT, UAKT_PER_AKT } from "@/lib/akash/chain-config";
import {
  DIRECT_RENT_GAS_RESERVE_UAKT,
  estimateBurnUaktForMintAmount,
  estimateDepositUact,
  estimateMintUactForWallet,
  parseGpuSdl,
  type GpuSdlInput,
} from "@/lib/akash/gpu-sdl";
import { DirectRentProgressReporter, type DirectRentProgressSnapshot } from "@/lib/akash/direct-rent-progress";
import { mintActFromAkt } from "@/lib/akash/mint-act";
import {
  resolveRentProviderTarget,
  type CatalogGpuPick,
} from "@/lib/akash/pick-rent-provider";
import {
  closeOpenAkashDeployments,
  closeStuckAkashDeployment,
  listStuckAkashDeployments,
} from "@/lib/akash/stuck-deployments";
import { buildAkashLeaseJobId } from "@/lib/akash/akash-lease-job-id";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { formatAkashTxError } from "@/lib/akash/akash-tx-errors";
import {
  bidMatchesGpuModelSlug,
  bidOffersAnyNvidiaWildcard,
  fetchOpenDeploymentBidsLcd,
  type DeploymentOpenBid,
} from "@/lib/akash/fetch-deployment-bids";
import {
  fetchLeaseInfoLcd,
  fetchManifestRetryEligibility,
} from "@/lib/akash/fetch-lease-info";
import {
  RENT_BID_GRACE_MS,
  RENT_BID_INITIAL_DELAY_MS,
  RENT_BID_MAX_WAIT_MS,
  RENT_BID_POLL_MS,
} from "@/lib/akash/gpu-rent-profile";
import { LOW_BID_RELIABILITY_PROVIDERS } from "@/lib/akash/rent-wait-estimate";
import { buildRentPhases, phaseWaitMsForPhase } from "@/lib/akash/gpu-rent-phases";
import { fetchMarketActiveGpuProviders } from "@/lib/akash/pick-rent-provider";
import { readDirectRentProgress } from "@/lib/akash/direct-rent-progress-storage";
import {
  bidDeploymentMismatchUserMessage,
  compareBidToDeployment,
} from "@/lib/akash/bid-deployment-alignment";
import { fetchDeploymentRowLcd } from "@/lib/akash/recover-manifest-json";
import type { BidResourceSummary } from "@/lib/akash/fetch-deployment-bids";
import { markAkashDseqJobs, readRentManifestJsonForDseq, upsertGlobalGpuJob, upsertLocalGpuJob } from "@/lib/gpu/job-storage";
import type { AkashLeaseJob } from "@/lib/gpu/types";

export { closeOpenAkashDeployments } from "@/lib/akash/stuck-deployments";

export type { DirectRentProgressSnapshot };

export type DirectRentInput = GpuSdlInput & {
  mnemonic: string;
  title?: string;
  /** Live AKT/USD — must match checkout; defaults to fetch + env fallback. */
  aktUsd?: number;
  /** Close active no-lease deployments before creating a new one. */
  closeStuckDeploymentsFirst?: boolean;
  /** Online marketplace card — lock rent to this host. */
  catalogPick?: CatalogGpuPick | null;
  /** If locked hosts do not bid, close and redeploy open-market (same GPU model). */
  allowOpenMarketFallback?: boolean;
  lcdPriceAmount?: string;
  lcdPriceDenom?: string;
  onProgress?: (p: DirectRentProgressSnapshot) => void;
};

export type DirectRentResult = {
  job: AkashLeaseJob;
  deploymentTxHash?: string;
  leaseTxHash?: string;
};

export type ResumeDirectRentInput = GpuSdlInput & {
  mnemonic: string;
  dseq: number;
  title?: string;
  /** Exact manifest from deploy time — required when SDL phase differs (e.g. any-NVIDIA). */
  manifestJson?: string;
  onProgress?: (p: DirectRentProgressSnapshot) => void;
};


function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchUactBalance(sdk: AkashChainSdk, address: string): Promise<number> {
  const res = await sdk.cosmos.bank.v1beta1.getAllBalances({ address });
  const row = res.balances?.find((b) => b.denom === AKASH_COMPUTE_DENOM);
  return Number(row?.amount ?? 0);
}

async function waitForUactBalance(input: {
  sdk: AkashChainSdk;
  owner: string;
  requiredUact: number;
  reporter?: DirectRentProgressReporter;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<number> {
  const maxAttempts = input.maxAttempts ?? 60;
  const intervalMs = input.intervalMs ?? 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const balance = await fetchUactBalance(input.sdk, input.owner);
    if (balance >= input.requiredUact) return balance;
    input.reporter?.poll(
      "mint_act",
      `Waiting for ACT to credit your wallet (${attempt}/${maxAttempts})…`,
    );
    await sleep(intervalMs);
  }

  throw new Error(
    "ACT mint did not credit your wallet in time. Akash settles BME mints in epochs (~1–3 min). If the burn was too small for 10 ACT, your AKT is refunded automatically — refresh your balance. Otherwise wait a minute and try again, or mint ACT in Akash Console first.",
  );
}

async function resolveAktUsd(override?: number): Promise<number> {
  if (Number.isFinite(override) && override! > 0) return override!;
  try {
    return await fetchLiveAktUsd();
  } catch {
    return getAktUsdEstimate();
  }
}

async function fetchUaktBalance(sdk: AkashChainSdk, address: string): Promise<number> {
  const res = await sdk.cosmos.bank.v1beta1.getAllBalances({ address });
  const row = res.balances?.find((b) => b.denom === "uakt");
  return Number(row?.amount ?? 0);
}

async function ensureActForDeposit(input: {
  sdk: AkashChainSdk;
  mnemonic: string;
  owner: string;
  depositUact: string;
  aktUsd?: number;
  reporter: DirectRentProgressReporter;
}) {
  const deposit = Number(input.depositUact) || 0;
  const existing = await fetchUactBalance(input.sdk, input.owner);
  if (existing >= deposit) {
    input.reporter.skip(
      "mint_act",
      `Wallet already has ${(existing / UACT_PER_ACT).toFixed(2)} ACT — no mint needed.`,
    );
    return;
  }

  const aktUsd = await resolveAktUsd(input.aktUsd);
  const mintUact = estimateMintUactForWallet(input.depositUact, existing);
  let burnUakt = Number(estimateBurnUaktForMintAmount(mintUact, aktUsd)) || 0;

  const walletUakt = await fetchUaktBalance(input.sdk, input.owner);
  const maxBurn = Math.max(0, walletUakt - DIRECT_RENT_GAS_RESERVE_UAKT);
  if (burnUakt > maxBurn) {
    throw new Error(
      `Not enough AKT to mint 10 ACT at $${aktUsd.toFixed(3)}/AKT (need ~${(burnUakt / UAKT_PER_AKT).toFixed(2)} AKT burn + gas; wallet has ~${(walletUakt / UAKT_PER_AKT).toFixed(2)} AKT). Refresh balance or add a small top-up.`,
    );
  }

  const burnAktLabel = (burnUakt / UAKT_PER_AKT).toFixed(2);
  input.reporter.activate(
    "mint_act",
    `Burning ~${burnAktLabel} AKT → minting ACT (min 10 ACT) @ $${aktUsd.toFixed(3)}/AKT…`,
  );
  const mintTxHash = await mintActFromAkt({
    mnemonic: input.mnemonic,
    owner: input.owner,
    burnUakt: String(burnUakt),
  });
  input.reporter.poll("mint_act", "Mint submitted — waiting for ACT on-chain…");
  await waitForUactBalance({
    sdk: input.sdk,
    owner: input.owner,
    requiredUact: deposit,
    reporter: input.reporter,
  });
  const creditedAct = await fetchUactBalance(input.sdk, input.owner);
  const actStr = (creditedAct / UACT_PER_ACT).toFixed(4);
  input.reporter.complete(
    "mint_act",
    `ACT mint successful — ${actStr} ACT compute credits in your wallet.`,
    mintTxHash,
  );
}

async function fetchLatestBlockHeight(sdk: AkashChainSdk): Promise<number> {
  const status = await sdk.cosmos.base.tendermint.v1beta1.getLatestBlock({});
  const h = status.block?.header?.height;
  const n = typeof h === "string" ? Number(h) : typeof h === "number" ? h : Number(h?.toString?.() ?? 0);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Could not read Akash block height.");
  return n;
}

async function ensureCertificate(
  sdk: AkashChainSdk,
  owner: string,
  _wallet: Awaited<ReturnType<typeof createAkashSdkFromMnemonic>>["wallet"],
) {
  const existing = await sdk.akash.cert.v1.getCertificates({
    filter: { owner, state: "valid", serial: "" },
  });
  if (existing.certificates?.length) {
    const stored = readManifestCertificatePem(owner);
    if (stored?.cert && stored.privateKey) return;
  }

  const pem = await generateAkashCertificatePem(owner);
  await sdk.akash.cert.v1.createCertificate({
    owner,
    cert: new TextEncoder().encode(pem.cert),
    pubkey: new TextEncoder().encode(pem.publicKey),
  });
  saveManifestCertificatePem(owner, pem);
  await sleep(8000);
}

type ParsedBid = {
  bidId: import("@akashnetwork/chain-sdk/chain/types/akash.v1").BidID;
  provider: string;
  resources?: DeploymentOpenBid["resources"];
};

function parseOpenBid(row: unknown): ParsedBid | null {
  const bid = (row as { bid?: { id?: { provider?: string }; resources_offer?: unknown[] } }).bid ??
    (row as { id?: { provider?: string }; resources_offer?: unknown[] });
  const id = bid?.id;
  const provider = id?.provider ?? "";
  if (!provider || !/^akash1[a-z0-9]{38}$/.test(provider)) return null;
  const resources = (bid as { resources_offer?: unknown[] }).resources_offer?.length
    ? parseBidResourcesFromRow(bid as Record<string, unknown>)
    : undefined;
  return { bidId: id as ParsedBid["bidId"], provider, resources };
}

function parseBidResourcesFromRow(bid: Record<string, unknown>): DeploymentOpenBid["resources"] {
  const offers = bid.resources_offer as { resources?: Record<string, unknown> }[] | undefined;
  const resources = (offers?.[0]?.resources ?? {}) as Record<string, unknown>;
  const cpu = resources.cpu as { units?: { val?: string } } | undefined;
  const memory = resources.memory as { quantity?: { val?: string } } | undefined;
  const storage = resources.storage as { quantity?: { val?: string } }[] | undefined;
  const gpu = resources.gpu as { attributes?: { key?: string }[] } | undefined;
  return {
    cpuUnits: Number(cpu?.units?.val ?? 0),
    memoryBytes: Number(memory?.quantity?.val ?? 0),
    storageBytes: Number(storage?.[0]?.quantity?.val ?? 0),
    gpuAttributeKeys: (gpu?.attributes ?? [])
      .map((a) => String(a?.key ?? "").trim())
      .filter(Boolean),
  };
}

/** Prefer marketplace host briefly, then accept any matching GPU bid (open deployment). */
const CATALOG_PREFERRED_WAIT_MS = 12_000;

/** After this, accept the first on-chain bid that matches GPU model (or any NVIDIA wildcard phase). */
const ACCEPT_MODEL_BID_AFTER_MS = 22_000;

function pickMatchingGpuBid(
  pool: ParsedBid[],
  input: { gpuModelSlug?: string; anyNvidiaGpu?: boolean },
): ParsedBid | null {
  const slug = input.gpuModelSlug?.trim();
  const anyNvidia = input.anyNvidiaGpu === true && !slug;
  if (anyNvidia) {
    return (
      pool.find(
        (b) => b.resources && bidOffersAnyNvidiaWildcard({ resources: b.resources }),
      ) ?? null
    );
  }
  if (slug) {
    return (
      pool.find(
        (b) => b.resources && bidMatchesGpuModelSlug({ resources: b.resources }, slug),
      ) ?? null
    );
  }
  return pool[0] ?? null;
}

function pickBestBid(
  parsed: ParsedBid[],
  input: {
    preferred?: string;
    allowed?: Set<string>;
    gpuModelSlug?: string;
    anyNvidiaGpu?: boolean;
    startedAt: number;
    catalogWaitMs?: number;
  },
): ParsedBid | null {
  const preferred = input.preferred?.trim().toLowerCase() || "";
  const allowed = input.allowed ?? new Set<string>();
  const catalogWaitMs = input.catalogWaitMs ?? CATALOG_PREFERRED_WAIT_MS;
  const elapsed = Date.now() - input.startedAt;
  const pastCatalogWait = elapsed >= catalogWaitMs;
  const pastModelFallback = elapsed >= ACCEPT_MODEL_BID_AFTER_MS;

  if (!parsed.length) return null;

  const withResources = parsed.filter((b) => Boolean(b.resources));
  const pool = withResources.length > 0 ? withResources : parsed;

  if (input.anyNvidiaGpu === true && !input.gpuModelSlug?.trim()) {
    const wildcard = pool.filter(
      (b) => !b.resources || bidOffersAnyNvidiaWildcard({ resources: b.resources }),
    );
    if (wildcard.length) return wildcard[0] ?? null;
    return pastModelFallback ? pool[0] ?? null : null;
  }

  if (allowed.size > 0) {
    const allowedHit = pool.find((b) => allowed.has(b.provider.toLowerCase()));
    if (allowedHit) return allowedHit;
    const modelFromAllowed = pickMatchingGpuBid(pool.filter((b) => allowed.has(b.provider.toLowerCase())), input);
    if (modelFromAllowed) return modelFromAllowed;
    if (!pastCatalogWait) return null;
    const modelBid = pickMatchingGpuBid(pool, input);
    if (modelBid) return modelBid;
    return pastModelFallback ? pool[0] ?? null : null;
  }

  if (preferred) {
    const prefEligible = pool.find((b) => b.provider.toLowerCase() === preferred);
    if (prefEligible) return prefEligible;
    if (!pastCatalogWait) {
      const modelBid = pickMatchingGpuBid(pool, input);
      if (modelBid && pastModelFallback) return modelBid;
      return null;
    }
  }

  const matched = pickMatchingGpuBid(pool, input);
  if (matched) return matched;
  return pastModelFallback ? pool[0] ?? null : null;
}

function lcdBidToParsed(b: DeploymentOpenBid): ParsedBid {
  return {
    bidId: b.bidId as unknown as ParsedBid["bidId"],
    provider: b.provider,
    resources: b.resources,
  };
}

async function listOpenBidsForDeployment(input: {
  sdk: AkashChainSdk;
  owner: string;
  dseq: number;
}): Promise<ParsedBid[]> {
  const [lcd, sdkBids] = await Promise.all([
    fetchOpenDeploymentBidsLcd(input.owner, input.dseq),
    input.sdk.akash.market.v1beta5
      .getBids({
        filters: {
          owner: input.owner,
          dseq: Long.fromNumber(input.dseq),
          state: "open",
        },
      })
      .then((res) => (res.bids ?? []).map(parseOpenBid).filter((b): b is ParsedBid => Boolean(b)))
      .catch(() => [] as ParsedBid[]),
  ]);

  const byProvider = new Map<string, ParsedBid>();
  for (const b of lcd.map(lcdBidToParsed)) {
    byProvider.set(b.provider.toLowerCase(), b);
  }
  for (const b of sdkBids) {
    const key = b.provider.toLowerCase();
    const prev = byProvider.get(key);
    if (!prev || (b.resources && !prev.resources)) byProvider.set(key, b);
  }
  return [...byProvider.values()];
}

async function waitForAnyProviderBid(input: {
  sdk: AkashChainSdk;
  owner: string;
  dseq: number;
  preferredProvider?: string;
  allowedProviders?: string[];
  gpuModelSlug?: string;
  anyNvidiaGpu?: boolean;
  reporter: DirectRentProgressReporter;
  maxWaitMs?: number;
  phaseLabel?: string;
}): Promise<ParsedBid> {
  const { sdk, owner, dseq, reporter } = input;
  const preferred = input.preferredProvider?.trim().toLowerCase() || "";
  const maxWaitMs = input.maxWaitMs ?? RENT_BID_MAX_WAIT_MS;
  const deadline = Date.now() + maxWaitMs;
  const allowed = new Set(
    (input.allowedProviders ?? []).map((p) => p.trim().toLowerCase()).filter(Boolean),
  );
  const phase = input.phaseLabel ? ` (${input.phaseLabel})` : "";

  reporter.activate(
    "provider_bids",
    allowed.size > 0
      ? `Waiting for bid from your provider${phase}…`
      : preferred
        ? `Waiting for ${preferred.slice(0, 12)}… or another qualifying host${phase}…`
        : `Waiting for Akash GPU providers${phase}…`,
  );

  const startedAt = Date.now();
  reporter.poll(
    "provider_bids",
    `Deployment posted — checking for provider bids every second (most hosts bid in 20–60s)…`,
  );
  await sleep(RENT_BID_INITIAL_DELAY_MS);

  while (Date.now() < deadline) {
    const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const parsed = await listOpenBidsForDeployment({ sdk, owner, dseq });
    const match = pickBestBid(parsed, {
      preferred,
      allowed,
      gpuModelSlug: input.gpuModelSlug,
      anyNvidiaGpu: input.anyNvidiaGpu && !input.gpuModelSlug?.trim(),
      startedAt,
    });

    if (match) {
      reporter.complete(
        "provider_bids",
        `Bid from ${match.provider.slice(0, 12)}… (${elapsedSec}s) — accepting automatically.`,
      );
      return match;
    }

    const openCount = parsed.length;
    if (openCount > 0) {
      const slug = input.gpuModelSlug?.trim();
      const waitingHost =
        allowed.size > 0 &&
        !parsed.some((b) => allowed.has(b.provider.toLowerCase()));
      const modelBid = slug
        ? parsed.find(
            (b) => b.resources && bidMatchesGpuModelSlug({ resources: b.resources }, slug),
          )
        : null;
      if (waitingHost && modelBid && Date.now() - startedAt >= CATALOG_PREFERRED_WAIT_MS) {
        reporter.poll(
          "provider_bids",
          `${openCount} bid(s) — accepting ${modelBid.provider.slice(0, 12)}… (${slug?.toUpperCase() ?? "GPU"}, ${elapsedSec}s)…`,
        );
      } else {
        reporter.poll(
          "provider_bids",
          waitingHost
            ? `${openCount} bid(s) on-chain — preferring your card host, then any ${slug?.toUpperCase() ?? "GPU"} (${elapsedSec}s)…`
            : slug
              ? `${openCount} bid(s) on-chain — matching ${slug.toUpperCase()} (${elapsedSec}s)…`
              : `${openCount} bid(s) on-chain — matching host (${elapsedSec}s)…`,
        );
      }
    } else {
      reporter.poll("provider_bids", `Waiting for provider bid — ${elapsedSec}s…`);
    }
    await sleep(RENT_BID_POLL_MS);
  }

  const waitSec = Math.round(maxWaitMs / 1000);
  throw new Error(`No provider bid within ${waitSec}s for deployment ${dseq}.`);
}

export const RENT_BID_TIMEOUT_USER_MESSAGE =
  "No provider bid in time. Akash hosts often bid 30–90s after deploy (slow hosts up to ~3 min). Use Complete pending rent below or GPU Jobs → Wait for bids again — do not pay again. Release stuck orders only to cancel.";

async function closeDeploymentQuietly(input: {
  mnemonic: string;
  dseq: number;
}): Promise<void> {
  try {
    await closeStuckAkashDeployment(input);
    await sleep(5000);
  } catch {
    /* already closed or chain rejected */
  }
}

async function fetchProviderHostUri(sdk: AkashChainSdk, providerOwner: string): Promise<string> {
  const res = await sdk.akash.provider.v1beta4.getProvider({ owner: providerOwner });
  const p = res.provider as { hostUri?: string; host_uri?: string } | undefined;
  const uri = String(p?.hostUri || p?.host_uri || "").trim();
  if (!uri) throw new Error(`Provider ${providerOwner.slice(0, 12)}… has no host URI on chain.`);
  return uri.replace(/\/$/, "");
}

async function resolveLeaseProvider(
  sdk: AkashChainSdk,
  owner: string,
  dseq: number,
): Promise<string> {
  try {
    const res = await sdk.akash.market.v1beta5.getLeases({
      filters: {
        owner,
        dseq: Long.fromNumber(dseq),
      },
    });
    for (const row of res.leases ?? []) {
      const lease = (row as { lease?: { id?: { provider?: string }; state?: string } }).lease ?? row;
      const state = String((lease as { state?: string }).state ?? "").toLowerCase();
      if (state && state !== "active") continue;
      const provider = sanitizeAkashAddress(
        (lease as { id?: { provider?: string } }).id?.provider,
      );
      if (provider) return provider;
    }
  } catch {
    /* fall through to LCD */
  }
  const lcd = await fetchLeaseInfoLcd(owner, dseq);
  return lcd?.state === "active" ? lcd.provider : "";
}

function storeJob(address: string, job: AkashLeaseJob) {
  upsertLocalGpuJob(address, job as { id: string } & Record<string, unknown>);
  upsertGlobalGpuJob(job as { id: string } & Record<string, unknown>);
}

function markRentFailed(
  address: string,
  dseq: number,
  message: string,
  providerStatus: "bid_timeout" | "manifest_failed" = "bid_timeout",
) {
  markAkashDseqJobs([address], dseq, {
    internal_status: providerStatus === "manifest_failed" ? "lease_active" : "failed",
    provider_status: providerStatus,
    error_message: message,
  });
}

export const MANIFEST_FETCH_USER_MESSAGE =
  "Manifest upload failed. Redeploy the latest NodeShare build, then tap Retry manifest — your lease is already on-chain.";

function resolveSavedManifestJson(
  address: string,
  dseq: number,
  explicit?: string,
): string | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromJob = readRentManifestJsonForDseq(address, dseq);
  if (fromJob) return fromJob;
  const progress = readDirectRentProgress(address);
  if (progress?.dseq === dseq && progress.manifestJson?.trim()) {
    return progress.manifestJson.trim();
  }
  return undefined;
}

async function completeLeaseFromBid(input: {
  sdk: AkashChainSdk;
  address: string;
  wallet: Awaited<ReturnType<typeof createAkashSdkFromMnemonic>>["wallet"];
  mnemonic: string;
  dseq: number;
  bidId: ParsedBid["bidId"];
  provider: string;
  bidResources?: BidResourceSummary;
  manifestJson?: string;
  reporter: DirectRentProgressReporter;
  title?: string;
  depositAct?: number;
  gpuLabel?: string;
  deploymentTxHash?: string;
  rentSdl?: AkashLeaseJob["rent_sdl"];
}): Promise<DirectRentResult> {
  const { sdk, address, reporter, dseq, provider } = input;

  const depRow = await fetchDeploymentRowLcd(address, dseq);
  if (depRow && input.bidResources) {
    const alignment = compareBidToDeployment(depRow, input.bidResources);
    if (alignment && !alignment.aligned) {
      const msg = bidDeploymentMismatchUserMessage(alignment);
      markRentFailed(address, dseq, msg, "manifest_failed");
      reporter.fail("manifest", msg);
      throw new Error(msg);
    }
  }

  reporter.activate("accept_lease", "Accepting provider bid and creating lease…");
  let leaseTxHash: string | undefined;
  try {
    const leaseRes = await sdk.akash.market.v1beta5.createLease({ bidId: input.bidId });
    leaseTxHash =
      (leaseRes as { txHash?: string }).txHash ??
      (leaseRes as { transactionHash?: string }).transactionHash;
  } catch (e) {
    const msg = formatAkashTxError(e);
    markRentFailed(address, dseq, msg);
    throw new Error(msg);
  }

  reporter.complete("accept_lease", "Lease created — provider assigned your GPU.", leaseTxHash);

  const savedManifestJson = resolveSavedManifestJson(address, dseq, input.manifestJson);

  await ensureCertificate(sdk, address, input.wallet);
  reporter.activate("manifest", "Uploading SDL manifest to provider…");
  const hostUri = await fetchProviderHostUri(sdk, provider);
  try {
    await sendManifestToProvider({
      hostUri,
      dseq,
      owner: address,
      provider,
      manifestJson: savedManifestJson,
      wallet: input.wallet,
      mnemonic: input.mnemonic,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Manifest upload failed";
    const msg = formatManifestUploadError(raw);
    markRentFailed(address, dseq, msg, "manifest_failed");
    throw new Error(msg);
  }

  reporter.complete("manifest", "Manifest delivered — provider is starting your container.");

  const jobId = buildAkashLeaseJobId(dseq, provider);
  const job: AkashLeaseJob = {
    id: jobId,
    kind: "akash-lease",
    internal_status: "running",
    provider_status: "lease_active",
    created_at: new Date().toISOString(),
    title: input.title || `Akash GPU · dseq ${dseq}`,
    provider_id: provider,
    dseq,
    gseq: 1,
    oseq: 1,
    owner: address,
    provider_owner: provider,
    deposit_akt: input.depositAct,
    gpu_model: input.gpuLabel,
    deployment_tx_hash: input.deploymentTxHash,
    lease_tx_hash: leaseTxHash,
    rent_sdl: input.rentSdl
      ? { ...input.rentSdl, manifestJson: savedManifestJson ?? input.rentSdl.manifestJson }
      : savedManifestJson
        ? {
            hours: 1,
            hourlyAkt: input.depositAct ?? 0.5,
            gpuLabel: input.gpuLabel,
            manifestJson: savedManifestJson,
          }
        : undefined,
  };

  storeJob(address, job);
  return { job, leaseTxHash };
}

export type RetryManifestInput = GpuSdlInput & {
  mnemonic: string;
  dseq: number;
  provider?: string;
  title?: string;
  /** Exact manifest JSON from deploy time (preferred for retry). */
  manifestJson?: string;
  onProgress?: (p: DirectRentProgressSnapshot) => void;
};

/** Lease already on-chain — resend manifest only (e.g. after CORS / Failed to fetch). */
export async function retryDirectAkashManifest(input: RetryManifestInput): Promise<DirectRentResult> {
  const reporter = new DirectRentProgressReporter(input.onProgress);
  reporter.start(`Sending manifest for dseq ${input.dseq}…`);

  const { sdk, address, wallet } = await createAkashSdkFromMnemonic(input.mnemonic);
  const dseq = input.dseq;

  const retryEligibility = await fetchManifestRetryEligibility(address, dseq);
  if (!retryEligibility.canRetryManifest) {
    throw new Error(
      retryEligibility.retryBlockedReason ||
        "Manifest retry is not available for this deployment.",
    );
  }

  const leaseInfo = retryEligibility.lease;
  const provider =
    sanitizeAkashAddress(input.provider) ||
    leaseInfo?.provider ||
    (await resolveLeaseProvider(sdk, address, dseq));
  if (!provider) {
    throw new Error(
      `No active lease for dseq ${dseq}. Close the deployment on Stuck orders to recover ACT, then rent again.`,
    );
  }

  await ensureCertificate(sdk, address, wallet);
  reporter.skip("mint_act", "Escrow already on-chain.");
  reporter.skip("create_deployment", `Deployment ${dseq} active.`);
  reporter.skip("provider_bids", "Provider already assigned.");
  reporter.skip("accept_lease", "Lease already created on Akash.");
  reporter.setDseq(dseq);

  const savedManifestJson = resolveSavedManifestJson(address, dseq, input.manifestJson);
  if (savedManifestJson) reporter.setManifestJson(savedManifestJson);

  reporter.activate(
    "manifest",
    `Uploading manifest to ${provider.slice(0, 12)}… (rebuilt from on-chain deployment)…`,
  );

  const hostUri = await fetchProviderHostUri(sdk, provider);
  try {
    await sendManifestToProvider({
      hostUri,
      dseq,
      owner: address,
      provider,
      manifestJson: savedManifestJson,
      wallet,
      mnemonic: input.mnemonic,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Manifest upload failed";
    const msg = formatManifestUploadError(raw);
    reporter.fail("manifest", msg);
    markRentFailed(address, dseq, msg, "manifest_failed");
    throw new Error(msg);
  }

  reporter.complete("manifest", "Manifest delivered — provider is starting your container.");

  const jobId = buildAkashLeaseJobId(dseq, provider);
  const job: AkashLeaseJob = {
    id: jobId,
    kind: "akash-lease",
    internal_status: "running",
    provider_status: "lease_active",
    created_at: new Date().toISOString(),
    title: input.title || `Akash GPU · dseq ${dseq}`,
    provider_id: provider,
    dseq,
    gseq: 1,
    oseq: 1,
    owner: address,
    provider_owner: provider,
    gpu_model: input.gpuLabel,
    rent_sdl: {
      hourlyAkt: input.hourlyAkt,
      hours: input.hours,
      gpuLabel: input.gpuLabel,
      gpuModelSlug: input.gpuModelSlug,
      anyNvidiaGpu: true,
      manifestJson: savedManifestJson,
    },
  };
  storeJob(address, job);
  return { job };
}

/** Continue an open deployment: wait for bids → lease → manifest (no new deploy). */
export async function resumeDirectAkashGpuRent(input: ResumeDirectRentInput): Promise<DirectRentResult> {
  const reporter = new DirectRentProgressReporter(input.onProgress);
  reporter.start(`Resuming deployment ${input.dseq}…`);

  const { sdk, address, wallet } = await createAkashSdkFromMnemonic(input.mnemonic);
  const dseq = input.dseq;
  const openMarket = input.openToAnyProvider !== false;
  const preferredProvider = input.providerOwner?.trim() || "";

  const stuck = await listStuckAkashDeployments(input.mnemonic);
  const row = stuck.find((s) => s.dseq === dseq);
  if (!row) {
    throw new Error(`Deployment ${dseq} is not an active open order (it may already have a lease or was closed).`);
  }
  await ensureCertificate(sdk, address, wallet);

  reporter.skip("mint_act", "Escrow already funded on this deployment.");
  reporter.skip("create_deployment", `Deployment ${dseq} is active on Akash.`);
  reporter.setDseq(dseq);

  const savedManifestJson = resolveSavedManifestJson(address, dseq, input.manifestJson);
  if (savedManifestJson) reporter.setManifestJson(savedManifestJson);

  const depositAct = row.escrowAct;

  const depRow = await fetchDeploymentRowLcd(address, dseq);
  const signedBy =
    depRow?.groups?.[0]?.group_spec?.requirements?.signed_by?.any_of ?? [];
  const deploymentOpenOnChain = signedBy.length === 0;

  const allowedProviders =
    deploymentOpenOnChain
      ? undefined
      : !openMarket && preferredProvider
        ? [preferredProvider]
        : !openMarket && row.preferredProviders.length > 0
          ? row.preferredProviders
          : undefined;

  try {
    const bid = await waitForAnyProviderBid({
      sdk,
      owner: address,
      dseq,
      preferredProvider: preferredProvider || row.preferredProviders[0],
      allowedProviders,
      gpuModelSlug: input.gpuModelSlug,
      anyNvidiaGpu: input.anyNvidiaGpu,
      reporter,
      maxWaitMs: RENT_BID_MAX_WAIT_MS,
    });

    return await completeLeaseFromBid({
      sdk,
      address,
      wallet,
      mnemonic: input.mnemonic,
      dseq,
      bidId: bid.bidId,
      provider: bid.provider,
      bidResources: bid.resources,
      manifestJson: savedManifestJson,
      reporter,
      title: input.title,
      depositAct,
      gpuLabel: input.gpuLabel,
      rentSdl: {
        hourlyAkt: input.hourlyAkt,
        hours: input.hours,
        gpuLabel: input.gpuLabel,
        gpuModelSlug: input.gpuModelSlug,
        openToAnyProvider: input.openToAnyProvider,
        manifestJson: savedManifestJson,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resume failed.";
    if (!reporter.current.failedStep) {
      reporter.fail("provider_bids", msg);
    }
    markRentFailed(address, dseq, msg);
    throw e;
  }
}

export async function directAkashGpuRent(input: DirectRentInput): Promise<DirectRentResult> {
  const reporter = new DirectRentProgressReporter(input.onProgress);

  const rentTarget = await resolveRentProviderTarget({
    gpuModelSlug: input.gpuModelSlug,
    gpuLabel: input.gpuLabel,
    preferredOwner: input.providerOwner,
    catalogPick: input.catalogPick,
  });
  if (rentTarget.warn) {
    reporter.poll("mint_act", rentTarget.warn);
  }

  if (rentTarget.rentBlocked) {
    const msg =
      rentTarget.blockReason ??
      "No online GPU host available for this model — pick another card on the marketplace.";
    reporter.fail("mint_act", msg);
    throw new Error(msg);
  }

  const preferredProviders =
    input.openToAnyProvider === true && !input.catalogPick
      ? []
      : input.providerOwners?.length
        ? input.providerOwners
        : rentTarget.providerOwners;
  const preferredProvider = preferredProviders[0] ?? input.providerOwner?.trim() ?? "";

  reporter.start(rentTarget.summary);

  const { sdk, address, wallet } = await createAkashSdkFromMnemonic(input.mnemonic);

  if (input.catalogPick && preferredProviders.length === 0) {
    throw new Error("No online Akash GPU provider available for this model — pick another GPU on the marketplace.");
  }

  await ensureCertificate(sdk, address, wallet);

  if (input.closeStuckDeploymentsFirst !== false) {
    const closed = await closeOpenAkashDeployments({
      mnemonic: input.mnemonic,
      onProgress: (m) => reporter.poll("mint_act", m),
    });
    if (closed > 0) {
      reporter.poll("mint_act", `Released ${closed} stuck deployment(s) — ACT escrow returned.`);
      await sleep(4000);
    }
  }

  const depositUact = estimateDepositUact(input.hours, input.hourlyAkt);
  const depositAct = Number(depositUact) / UACT_PER_ACT;
  const marketActive = await fetchMarketActiveGpuProviders();
  const catalogOwner = input.catalogPick?.providerOwner?.trim().toLowerCase() ?? "";
  const catalogMarketActive = catalogOwner ? marketActive.has(catalogOwner) : false;
  const hasLcdSpot = Boolean(input.lcdPriceAmount?.trim());
  const catalogModelLocked = Boolean(
    input.catalogPick?.gpuModelSlug?.trim() || input.gpuModelSlug?.trim(),
  );
  const deploymentOpenMarket = rentTarget.openToAnyProvider !== false;
  const phases = buildRentPhases(input, preferredProviders, deploymentOpenMarket, {
    skipLockedCatalogPhase:
      deploymentOpenMarket ||
      !input.catalogPick ||
      !catalogMarketActive ||
      Boolean(input.catalogPick),
    skipAnyNvidiaPhase: catalogModelLocked,
  });
  if (phases[0]?.kind === "locked" && input.catalogPick) {
    const locked =
      phases[0].allowedProviders?.[0] ??
      preferredProviders[0] ??
      input.catalogPick.providerOwner ??
      "";
    const slow = LOW_BID_RELIABILITY_PROVIDERS.has(locked.toLowerCase());
    if (slow && !catalogMarketActive && !hasLcdSpot) {
      reporter.poll(
        "mint_act",
        "Waiting for your marketplace host first (open deployment) — slow hosts often bid in 1–3 min.",
      );
    }
  }

  try {
    await ensureActForDeposit({
      sdk,
      mnemonic: input.mnemonic,
      owner: address,
      depositUact,
      aktUsd: input.aktUsd,
      reporter,
    });

    let leaseDseq = 0;
    let leaseManifestJson: string | undefined;
    let leaseRentSdl: AkashLeaseJob["rent_sdl"];
    let leaseDeploymentTxHash: string | undefined;
    let bidId: ParsedBid["bidId"] | null = null;
    let bidResources: BidResourceSummary | undefined;
    let provider = "";

    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
      const phase = phases[phaseIndex];
      if (phaseIndex > 0 && leaseDseq > 0) {
        reporter.poll("provider_bids", `Expanding search — ${phase.label}…`);
        await closeDeploymentQuietly({ mnemonic: input.mnemonic, dseq: leaseDseq });
        markRentFailed(address, leaseDseq, `Retry: ${phase.label}`);
      }

      const parsed = await parseGpuSdl({
        ...phase.sdl,
        aktUsd: input.aktUsd,
        bidEscalation: phase.bidEscalation,
      });
      leaseManifestJson = parsed.manifestJson;
      reporter.setManifestJson(leaseManifestJson);

      reporter.activate(
        "create_deployment",
        phaseIndex === 0
          ? `Creating deployment with ${depositAct.toFixed(1)} ACT escrow…`
          : `Posting ${phase.label}…`,
      );
      leaseDseq = await fetchLatestBlockHeight(sdk);
      reporter.setDseq(leaseDseq, `Deployment dseq ${leaseDseq} (${phase.label})…`, leaseManifestJson);

      const deployRes = await sdk.akash.deployment.v1beta4.createDeployment({
        id: { owner: address, dseq: Long.fromNumber(leaseDseq) },
        groups: parsed.groups,
        hash: parsed.hash,
        deposit: {
          amount: { denom: AKASH_COMPUTE_DENOM, amount: depositUact },
          sources: [Source.balance],
        },
      });
      leaseDeploymentTxHash =
        (deployRes as { txHash?: string }).txHash ??
        (deployRes as { transactionHash?: string }).transactionHash;

      reporter.complete(
        "create_deployment",
        `Deployment ${leaseDseq} active — ${phase.label}.`,
        leaseDeploymentTxHash,
      );

      leaseRentSdl = {
        hourlyAkt: input.hourlyAkt,
        hours: input.hours,
        gpuLabel: input.gpuLabel,
        gpuModelSlug: input.gpuModelSlug,
        openToAnyProvider: phase.sdl.openToAnyProvider !== false,
        anyNvidiaGpu: phase.sdl.anyNvidiaGpu === true,
        manifestJson: parsed.manifestJson,
      };
      storeJob(address, {
        id: `akash-${leaseDseq}-open`,
        kind: "akash-lease",
        internal_status: "awaiting_bid",
        provider_status: "deployment_active",
        created_at: new Date().toISOString(),
        title: input.title || `Akash GPU · dseq ${leaseDseq}`,
        provider_id: sanitizeAkashAddress(phase.allowedProviders?.[0]) || "pending",
        dseq: leaseDseq,
        gseq: 1,
        oseq: 1,
        owner: address,
        provider_owner: sanitizeAkashAddress(phase.allowedProviders?.[0]) || "pending",
        deposit_akt: depositAct,
        gpu_model: input.gpuLabel,
        deployment_tx_hash: leaseDeploymentTxHash,
        rent_sdl: leaseRentSdl,
      });

      try {
        const bid = await waitForAnyProviderBid({
          sdk,
          owner: address,
          dseq: leaseDseq,
          preferredProvider: preferredProvider || undefined,
          allowedProviders: phase.allowedProviders,
          gpuModelSlug: phase.sdl.gpuModelSlug ?? input.gpuModelSlug,
          anyNvidiaGpu: phase.sdl.anyNvidiaGpu === true,
          reporter,
          maxWaitMs: phaseWaitMsForPhase(phaseIndex, phases.length, phase),
          phaseLabel: phase.label,
        });
        bidId = bid.bidId;
        provider = bid.provider;
        bidResources = bid.resources;
        break;
      } catch (phaseErr) {
        reporter.poll(
          "provider_bids",
          "No qualifying bid yet — checking once more before next step…",
        );
        try {
          const bid = await waitForAnyProviderBid({
            sdk,
            owner: address,
            dseq: leaseDseq,
            preferredProvider: preferredProvider || undefined,
            allowedProviders: phase.allowedProviders,
            gpuModelSlug: phase.sdl.gpuModelSlug ?? input.gpuModelSlug,
            anyNvidiaGpu: phase.sdl.anyNvidiaGpu === true,
            reporter,
            maxWaitMs: RENT_BID_GRACE_MS,
            phaseLabel: `${phase.label} (extra wait)`,
          });
          bidId = bid.bidId;
          provider = bid.provider;
          bidResources = bid.resources;
          break;
        } catch {
          if (phaseIndex === phases.length - 1) {
            reporter.fail("provider_bids", RENT_BID_TIMEOUT_USER_MESSAGE);
            throw phaseErr instanceof Error
              ? new Error(RENT_BID_TIMEOUT_USER_MESSAGE)
              : new Error(RENT_BID_TIMEOUT_USER_MESSAGE);
          }
        }
      }
    }

    if (!bidId || !provider) {
      throw new Error(RENT_BID_TIMEOUT_USER_MESSAGE);
    }

    if (!leaseManifestJson) {
      throw new Error("Manifest JSON missing after deploy — rent again from checkout.");
    }

    const result = await completeLeaseFromBid({
      sdk,
      address,
      wallet,
      mnemonic: input.mnemonic,
      dseq: leaseDseq,
      bidId,
      provider,
      bidResources,
      manifestJson: leaseManifestJson,
      reporter,
      title: input.title,
      depositAct,
      gpuLabel: input.gpuLabel,
      deploymentTxHash: leaseDeploymentTxHash,
      rentSdl: leaseRentSdl,
    });

    return { ...result, deploymentTxHash: leaseDeploymentTxHash };
  } catch (e) {
    const snap = reporter.current;
    const msg = e instanceof Error ? e.message : "Rent failed.";
    if (!snap.failedStep) {
      const active = (
        ["manifest", "accept_lease", "provider_bids", "create_deployment", "mint_act"] as const
      ).find((id) => snap.steps[id].status === "active");
      if (active) {
        reporter.fail(active, msg);
      }
    }
    if (snap.dseq != null) {
      markRentFailed(address, snap.dseq, msg);
    }
    throw e;
  }
}
