const GPU_CHIP_RE = /gpu|nvidia|amd|a100|a10|h100|l40|rtx|tesla|mi250/i;

export function pickGpuChip(chips: string[]): string | null {
  const hit = chips.find((c) => GPU_CHIP_RE.test(c));
  return hit?.trim() || null;
}

export function formatGpuHeadline(input: {
  gpuModel?: string | null;
  title?: string;
  resourceChips?: string[];
  hasGpu?: boolean;
}): { headline: string; subline: string; isGpu: boolean } {
  const fromModel = input.gpuModel?.trim();
  const fromChips = input.resourceChips ? pickGpuChip(input.resourceChips) : null;
  const headline = fromModel || fromChips || (input.hasGpu ? "GPU compute" : input.title?.trim() || "Compute");
  const isGpu = Boolean(fromModel || fromChips || input.hasGpu);

  let subline = "Akash spot bid";
  if (isGpu && fromModel && !/open model bid|any model|^NVIDIA GPU$/i.test(fromModel)) {
    subline = /RTX|A100|H100|4090|3090|4080|6000|L40|Tesla|MI250/i.test(fromModel)
      ? "Verified GPU · Akash provider"
      : "Live graphics card on this offer";
  } else if (isGpu && fromModel && /open model bid/i.test(fromModel)) {
    subline = "Open NVIDIA model bid (LCD)";
  } else if (isGpu && fromChips && !/open model bid/i.test(fromChips)) {
    subline = "Live graphics card on this offer";
  } else if (isGpu && fromModel) subline = "Provider GPU inventory (Console API)";
  else if (isGpu && fromChips) subline = "GPU on this bid";
  else if (!isGpu) subline = "CPU / memory workload";

  return { headline, subline, isGpu };
}
