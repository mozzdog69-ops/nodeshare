import { parseLcdAkashOrderId } from "@/lib/gpu/resolve-backend-offer";

const CONSOLE_ORIGIN = "https://console.akash.network";

/** Best-effort deep link into Akash Console for an open LCD bid. */
export function buildAkashConsoleDeployUrl(input: {
  lcdOrderId?: string;
  providerOwner?: string;
}): string {
  const lcd = String(input.lcdOrderId || "").trim();
  const parts = parseLcdAkashOrderId(lcd);
  const owner = String(input.providerOwner || "").trim();

  if (parts?.dseq && owner.startsWith("akash1")) {
    const qs = new URLSearchParams({ dseq: parts.dseq, provider: owner });
    return `${CONSOLE_ORIGIN}/new/lease?${qs.toString()}`;
  }
  if (parts?.dseq) {
    return `${CONSOLE_ORIGIN}/new/lease?dseq=${encodeURIComponent(parts.dseq)}`;
  }
  return `${CONSOLE_ORIGIN}/new/lease`;
}

export function akashConsoleOrigin(): string {
  return CONSOLE_ORIGIN;
}

/** Open this lease in Akash Console (shell / logs when in-browser terminal is unavailable). */
export function buildAkashConsoleLeaseUrl(input: {
  provider: string;
  dseq: number;
  gseq?: number;
  oseq?: number;
}): string {
  const provider = String(input.provider || "").trim();
  const dseq = Math.floor(Number(input.dseq));
  const gseq = Math.floor(Number(input.gseq ?? 1)) || 1;
  const oseq = Math.floor(Number(input.oseq ?? 1)) || 1;
  if (!provider.startsWith("akash1") || !dseq) return `${CONSOLE_ORIGIN}/deploy`;
  return `${CONSOLE_ORIGIN}/provider/${encodeURIComponent(provider)}/lease/${dseq}/${gseq}/${oseq}`;
}
