/** Direct Akash rent job id: `akash-{dseq}-{providerPrefix}` (10-char provider prefix). */
export function parseAkashLeaseJobId(jobId: string): { dseq: number; providerPrefix: string } | null {
  const trimmed = String(jobId || "").trim();
  const m = /^akash-(\d+)-(akash1[a-z0-9]{4,12})$/i.exec(trimmed);
  if (!m) return null;
  const dseq = Math.floor(Number(m[1]));
  if (!Number.isFinite(dseq) || dseq <= 0) return null;
  return { dseq, providerPrefix: m[2].toLowerCase() };
}

export function buildAkashLeaseJobId(dseq: number, provider: string): string {
  const p = String(provider || "").trim();
  return `akash-${Math.floor(dseq)}-${p.slice(0, 10)}`;
}

/** Match full `akash1…` address from a short prefix (LCD / local job list). */
export function resolveProviderFromPrefix(
  prefix: string,
  candidates: string[],
): string | null {
  const p = String(prefix || "").trim().toLowerCase();
  if (!p) return null;
  const exact = candidates.find((c) => c.toLowerCase() === p);
  if (exact) return exact;
  const starts = candidates.filter((c) => c.toLowerCase().startsWith(p));
  if (starts.length === 1) return starts[0]!;
  return starts[0] ?? null;
}
