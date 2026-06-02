export const DIRECT_RENT_STEPS = [
  { id: "mint_act", label: "Mint ACT" },
  { id: "create_deployment", label: "Create deployment" },
  { id: "provider_bids", label: "Provider bid" },
  { id: "accept_lease", label: "You accept lease" },
  { id: "manifest", label: "Manifest sent to provider" },
] as const;

export type DirectRentStepId = (typeof DIRECT_RENT_STEPS)[number]["id"];

export type DirectRentStepStatus = "pending" | "active" | "complete" | "skipped" | "error";

export type DirectRentStepState = {
  status: DirectRentStepStatus;
  detail?: string;
  txHash?: string;
};

export type DirectRentProgressSnapshot = {
  steps: Record<DirectRentStepId, DirectRentStepState>;
  message: string;
  dseq?: number;
  failedStep?: DirectRentStepId;
  /** Exact manifest JSON from deploy (for manifest-only retry). */
  manifestJson?: string;
};

function initialStepStates(): Record<DirectRentStepId, DirectRentStepState> {
  return {
    mint_act: { status: "pending" },
    create_deployment: { status: "pending" },
    provider_bids: { status: "pending" },
    accept_lease: { status: "pending" },
    manifest: { status: "pending" },
  };
}

export function createInitialRentProgress(message = "Starting on-chain rent…"): DirectRentProgressSnapshot {
  return { steps: initialStepStates(), message };
}

export function buildRentProgress(input: {
  steps: Partial<Record<DirectRentStepId, Partial<DirectRentStepState>>>;
  message: string;
  dseq?: number;
  failedStep?: DirectRentStepId;
  manifestJson?: string;
  prior?: DirectRentProgressSnapshot;
}): DirectRentProgressSnapshot {
  const base = input.prior?.steps ?? initialStepStates();
  const steps = { ...base };
  for (const def of DIRECT_RENT_STEPS) {
    const patch = input.steps[def.id];
    if (patch) {
      steps[def.id] = { ...steps[def.id], ...patch };
    }
  }
  return {
    steps,
    message: input.message,
    dseq: input.dseq ?? input.prior?.dseq,
    failedStep: input.failedStep,
    manifestJson: input.manifestJson ?? input.prior?.manifestJson,
  };
}

export function stepIndex(id: DirectRentStepId): number {
  return DIRECT_RENT_STEPS.findIndex((s) => s.id === id);
}

/** Mark all steps before `id` as complete (if still pending/active). */
export function completeStepsBefore(
  steps: Record<DirectRentStepId, DirectRentStepState>,
  id: DirectRentStepId,
): Record<DirectRentStepId, DirectRentStepState> {
  const idx = stepIndex(id);
  const next = { ...steps };
  for (let i = 0; i < idx; i += 1) {
    const sid = DIRECT_RENT_STEPS[i].id;
    const cur = next[sid];
    if (cur.status === "pending" || cur.status === "active") {
      next[sid] = { ...cur, status: cur.status === "active" ? "complete" : cur.status };
    }
    if (next[sid].status === "pending") {
      next[sid] = { ...next[sid], status: "complete" };
    }
  }
  return next;
}

export function akashTxExplorerUrl(txHash: string): string {
  const h = txHash.trim();
  if (!h) return "";
  return `https://www.mintscan.io/akash/tx/${h}`;
}
