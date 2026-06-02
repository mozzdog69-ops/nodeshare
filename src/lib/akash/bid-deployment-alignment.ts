import type { DeploymentLcdRow } from "@/lib/akash/recover-manifest-json";
import type { BidResourceSummary } from "@/lib/akash/fetch-deployment-bids";

export type BidDeploymentAlignment = {
  aligned: boolean;
  deployment: BidResourceSummary;
  bid: BidResourceSummary;
  issues: string[];
};

function deploymentResourcesFromRow(row: DeploymentLcdRow | null): BidResourceSummary | null {
  const res = row?.groups?.[0]?.group_spec?.resources?.[0]?.resource;
  if (!res) return null;
  return {
    cpuUnits: Number(res.cpu?.units?.val ?? 0),
    memoryBytes: Number(res.memory?.quantity?.val ?? 0),
    storageBytes: Number(res.storage?.[0]?.quantity?.val ?? 0),
    gpuAttributeKeys: (res.gpu?.attributes ?? [])
      .map((a) => String(a.key ?? "").trim())
      .filter(Boolean),
  };
}

function gpuLabel(keys: string[]): string {
  const model = keys.find((k) => k.includes("/model/"));
  if (!model) return "none";
  if (model.includes("/model/*")) return "any NVIDIA";
  return model.split("/model/")[1] || model;
}

/** Compare active provider bid resources to on-chain deployment group spec. */
export function compareBidToDeployment(
  row: DeploymentLcdRow | null,
  bid: BidResourceSummary | null | undefined,
): BidDeploymentAlignment | null {
  const deployment = deploymentResourcesFromRow(row);
  if (!deployment || !bid) return null;

  const issues: string[] = [];
  // CPU/RAM/disk underbid is normal on Akash — providers offer what they run; do not block lease/manifest.

  const depGpu = gpuLabel(deployment.gpuAttributeKeys);
  const bidGpu = gpuLabel(bid.gpuAttributeKeys);
  const bidAny = bid.gpuAttributeKeys.some((k) => k.includes("/model/*"));
  const depAny = deployment.gpuAttributeKeys.some((k) => k.includes("/model/*"));
  if (!depAny && bidGpu !== depGpu && !bidAny) {
    issues.push(`GPU bid ${bidGpu} does not match deployment ${depGpu}`);
  }
  if (depAny && !bidAny && bidGpu !== "any NVIDIA") {
    issues.push(
      `Deployment allows any NVIDIA (model/*) but bid is locked to ${bidGpu} — many providers reject the manifest after lease`,
    );
  }

  return {
    aligned: issues.length === 0,
    deployment,
    bid,
    issues,
  };
}

export function bidDeploymentMismatchUserMessage(alignment: BidDeploymentAlignment): string {
  return (
    "This provider's GPU bid does not match your deployment model on-chain. " +
    `Issues: ${alignment.issues.join("; ")}. ` +
    "Close this deployment on Stuck orders to recover ACT, then rent again with a matching GPU card."
  );
}
